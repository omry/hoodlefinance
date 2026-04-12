import type { ResolutionResult } from "./planner";
import type { ResolverPlan } from "./resolver-classes";
import {
  RawRequestInput,
  type RequestInput,
  type ResolvedRequest,
} from "./request";
import {
  resolveDirectIsinAttributeValue,
  resolveIsinAttributeValue,
} from "./isin-lookup";
import {
  extractAttributeValue,
} from "./attribute-extraction";
import { extractTickerSourceOverride } from "./request-parsing";
import type { TextHttpResponse } from "./text-http-response";

interface QuotePlanOutcome {
  error?: unknown;
  status: "failure" | "success";
  value?: unknown;
}

interface ResolvablePlan<TRequest, TValue> {
  describe(request: TRequest): string;
  resolve(request: TRequest): ResolutionResult<TValue>;
}

export interface LookupExecutionSelection {
  attributePlan: ResolverPlan | null;
  buildAttributePlan:
    | ((resolvedIdentifierRequest: ResolvedRequest) => ResolverPlan | null)
    | null;
  identifierPlan: ResolverPlan | null;
  requestInput: RequestInput;
  resolvedRequest: ResolvedRequest | null;
}

interface ResolvedQuoteLookup {
  attributePlan: ResolverPlan | null;
  result: LookupResult;
  resolvedRequest: ResolvedRequest | null;
}

export interface RequestResolutionDependencies {
  httpFetch(url: string): TextHttpResponse;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
  selectLookupExecution(requestInput: RawRequestInput): LookupExecutionSelection;
}

export interface LookupResult {
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}

function failureResult(
  route: string,
  error: unknown,
): LookupResult {
  return {
    error: error instanceof Error ? error.message : String(error || ""),
    route,
    status: "failure",
    value: null,
  };
}

function normalizePlanOutcome(
  route: string,
  outcome: QuotePlanOutcome,
): LookupResult {
  const normalized: LookupResult = {
    route,
    status: outcome.status,
    value:
      outcome.status === "success" &&
      Object.prototype.hasOwnProperty.call(outcome, "value")
        ? outcome.value
        : null,
  };

  if (outcome.error != null) {
    normalized.error = String(
      outcome.error instanceof Error ? outcome.error.message : outcome.error,
    );
  }

  return normalized;
}

function requireResolvablePlan<TRequest, TValue>(
  plan: ResolverPlan | null | undefined,
  errorMessage: string,
): ResolvablePlan<TRequest, TValue> {
  if (!plan || typeof plan.resolve !== "function") {
    throw new Error(errorMessage);
  }

  return plan as ResolvablePlan<TRequest, TValue>;
}

function validateDeferredLookupModes(requestInput: RequestInput): void {
  const infoMode = String(requestInput.infoMode || "").trim();

  if (infoMode === "source-override") {
    const sourceOverride = extractTickerSourceOverride(requestInput.identifier);

    throw new Error(`"@${sourceOverride}" is not available for this request.`);
  }

  if (infoMode) {
    throw new Error("Ticker route introspection is not yet available.");
  }
}


export function resolvePlannedQuoteResult(
  attributePlan: ResolverPlan,
  resolvedRequest: ResolvedRequest,
): LookupResult {
  const resolvableAttributePlan = requireResolvablePlan<ResolvedRequest, unknown>(
    attributePlan,
    "Attribute plan cannot execute this request.",
  );
  const route = resolvableAttributePlan.describe(resolvedRequest);
  const outcome = resolvableAttributePlan.resolve(resolvedRequest);

  return normalizePlanOutcome(route, {
    error: outcome.status === "failure" ? outcome.error : undefined,
    status: outcome.status,
    value: outcome.status === "success" ? outcome.value : null,
  });
}

function tryResolveDirectIsinValue(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
): LookupResult | null {
  if (requestInput.attributeType !== "isin") {
    return null;
  }

  const directResolution = resolveDirectIsinAttributeValue(
    {
      tickerInput: requestInput.ticker,
    },
    {
      fetchText: (url) => env.httpFetch(url).getContentText(),
      getCachedString: env.getCachedString,
      looksLikeIsin: env.looksLikeIsin,
      putCachedString: env.putCachedString,
    },
  );

  if (!directResolution) {
    return null;
  }

  return {
    route: directResolution.route,
    status: "success",
    value: directResolution.value,
  };
}

function resolveIdentifierPlanLookup(
  requestInput: RequestInput,
  lookupSelection: LookupExecutionSelection,
): ResolvedQuoteLookup {
  const identifierPlan = lookupSelection.identifierPlan;

  if (!identifierPlan) {
    return {
      attributePlan: null,
      result: failureResult("(none)", "Identifier resolution failed."),
      resolvedRequest: null,
    };
  }

  const resolvableIdentifierPlan = requireResolvablePlan<
    RequestInput,
    ResolvedRequest
  >(identifierPlan, "Identifier plan cannot resolve this request.");
  const identifierRoute = resolvableIdentifierPlan.describe(requestInput);
  const identifierOutcome = resolvableIdentifierPlan.resolve(
    requestInput,
  );

  if (identifierOutcome.status !== "success") {
    return {
      attributePlan: null,
      result: failureResult(
        identifierRoute,
        identifierOutcome.error,
      ),
      resolvedRequest: null,
    };
  }

  const attributePlan = lookupSelection.buildAttributePlan
    ? lookupSelection.buildAttributePlan(identifierOutcome.value)
    : null;

  if (!attributePlan) {
    return {
      attributePlan: null,
      result: failureResult(
        identifierRoute,
        "No attribute route is available for this request.",
      ),
      resolvedRequest: identifierOutcome.value,
    };
  }

  return {
    attributePlan,
    result: resolvePlannedQuoteResult(
      attributePlan,
      identifierOutcome.value,
    ),
    resolvedRequest: identifierOutcome.value,
  };
}

 
function finalizeLookupValue(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
  lookupResult: LookupResult,
  attributePlan?: ResolverPlan | null,
  resolvedRequest?: ResolvedRequest | null,
): LookupResult {
  if (lookupResult.status !== "success") {
    return lookupResult;
  }

  const quote = {
    ...((lookupResult.value || {}) as Record<string, unknown>),
  };
 
  try {
    const fxResult =
      attributePlan &&
      typeof (
        attributePlan as ResolverPlan & {
          resolveOutputCurrencyResult?: (
            request: RequestInput,
            value: Record<string, unknown>,
          ) => LookupResult | null;
        }
      ).resolveOutputCurrencyResult === "function"
        ? (
            attributePlan as ResolverPlan & {
              resolveOutputCurrencyResult(
                request: RequestInput,
                value: Record<string, unknown>,
              ): LookupResult | null;
            }
          ).resolveOutputCurrencyResult(requestInput, quote)
        : null;

    if (fxResult) {
      if (fxResult.status === "success") {
        const rate = Number(fxResult.value);
        if (Number.isFinite(rate)) {
          quote.hoodlefinanceFxUnitScale = rate;
        }
      }
    }
 
    const value =
      requestInput.attributeType === "isin"
        ? resolveIsinAttributeValue(
            quote,
            {
              tickerInput: requestInput.ticker,
            },
            {
              fetchText: (url) => env.httpFetch(url).getContentText(),
              getCachedString: env.getCachedString,
              looksLikeIsin: env.looksLikeIsin,
              putCachedString: env.putCachedString,
            },
          )
        : extractAttributeValue(
            quote,
            requestInput.attribute,
            attributePlan &&
              resolvedRequest &&
              typeof attributePlan.buildRuntimePlan === "function"
              ? {
                  routeState:
                    attributePlan.buildRuntimePlan(resolvedRequest).routeState ||
                    null,
                  tickerInput: requestInput.ticker,
                }
              : {
                  tickerInput: requestInput.ticker,
                },
          );

    return {
      ...lookupResult,
      value,
    };
  } catch (error) {
    return failureResult(lookupResult.route, error);
  }
}

export function resolveRequestValue(
  env: RequestResolutionDependencies,
  requestInput: RawRequestInput,
): LookupResult {
  let lookupSelection: LookupExecutionSelection | null = null;

  try {
    lookupSelection = env.selectLookupExecution(requestInput);
  } catch (error) {
    return failureResult("(none)", error);
  }

  const normalizedRequestInput = lookupSelection.requestInput;

  try {
    validateDeferredLookupModes(normalizedRequestInput);
  } catch (error) {
    return failureResult("(none)", error);
  }

  try {
    const directResult = tryResolveDirectIsinValue(env, normalizedRequestInput);

    if (directResult) {
      return directResult;
    }
  } catch (error) {
    return failureResult("(none)", error);
  }

  let effectiveAttributePlan = lookupSelection.attributePlan || null;
  let effectiveResolvedRequest = lookupSelection.resolvedRequest || null;
  const lookupResult =
    effectiveAttributePlan && effectiveResolvedRequest
      ? resolvePlannedQuoteResult(
          effectiveAttributePlan,
          effectiveResolvedRequest,
        )
      : lookupSelection.identifierPlan
        ? (() => {
            const identifierLookup = resolveIdentifierPlanLookup(
              normalizedRequestInput,
              lookupSelection,
            );
            effectiveAttributePlan = identifierLookup.attributePlan;
            effectiveResolvedRequest = identifierLookup.resolvedRequest;
            return identifierLookup.result;
          })()
        : failureResult(
            "(none)",
            "Identifier resolution failed.",
          );

  return finalizeLookupValue(
    env,
    normalizedRequestInput,
    lookupResult,
    effectiveAttributePlan,
    effectiveResolvedRequest,
  );
}
