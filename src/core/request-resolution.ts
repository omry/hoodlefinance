import type {
  ResolvePlan,
  ResolutionResult,
  ResolverPlanNode,
} from "./planner";
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
import { buildSourceOverrideUnavailableError } from "./plan-selection";
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

type RequestResolutionPlan = Pick<
  ResolvePlan,
  | "buildAttributePlan"
  | "debugValue"
  | "identifierPlan"
  | "plannedRoute"
  | "requestInput"
  | "resolvedRequest"
>;

interface ResolvedQuoteLookup {
  attributePlan: ResolverPlanNode | null;
  result: LookupResult;
  resolvedRequest: ResolvedRequest | null;
}

export interface RequestResolutionDependencies {
  buildResolvePlan(
    requestInput: RawRequestInput | RequestInput,
  ): Readonly<ResolvePlan>;
  classifyRawRequest?(requestInput: RawRequestInput): RequestInput;
  httpFetch(url: string): TextHttpResponse;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
}

export interface LookupResult {
  attemptedRoutes: string[];
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}

function failureResult(
  route: string,
  attemptedRoutes: string[],
  error: unknown,
): LookupResult {
  return {
    attemptedRoutes,
    error: error instanceof Error ? error.message : String(error || ""),
    route,
    status: "failure",
    value: null,
  };
}

function normalizePlanOutcome(
  route: string,
  attemptedRoutes: string[],
  outcome: QuotePlanOutcome,
): LookupResult {
  const normalized: LookupResult = {
    attemptedRoutes,
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
  plan: ResolverPlanNode | null | undefined,
  errorMessage: string,
): ResolvablePlan<TRequest, TValue> {
  if (!plan || typeof plan.resolve !== "function") {
    throw new Error(errorMessage);
  }

  return plan as ResolvablePlan<TRequest, TValue>;
}

function validateDeferredLookupModes(requestInput: RequestInput): void {
  const infoMode = String(requestInput.infoMode || "").trim();
  const sourceOverride = String(requestInput.sourceOverride || "")
    .trim()
    .toUpperCase();

  if (infoMode) {
    throw new Error("Ticker route introspection is not yet available.");
  }

  if (sourceOverride) {
    throw buildSourceOverrideUnavailableError(sourceOverride);
  }
}

function normalizeRequestInput(
  env: RequestResolutionDependencies,
  requestInput: RawRequestInput | RequestInput,
): RequestInput {
  if (!(requestInput instanceof RawRequestInput)) {
    return requestInput;
  }

  if (typeof env.classifyRawRequest === "function") {
    return env.classifyRawRequest(requestInput);
  }

  return env.buildResolvePlan(requestInput).requestInput;
}

export function resolvePlannedQuoteResult(
  attributePlan: ResolverPlanNode,
  resolvedRequest: ResolvedRequest,
  attemptedRoutes: string[],
): LookupResult {
  const resolvableAttributePlan = requireResolvablePlan<ResolvedRequest, unknown>(
    attributePlan,
    "Attribute plan cannot execute this request.",
  );
  const route = resolvableAttributePlan.describe(resolvedRequest);
  const outcome = resolvableAttributePlan.resolve(resolvedRequest);

  return normalizePlanOutcome(route, attemptedRoutes.concat([route]), {
    error: outcome.status === "failure" ? outcome.error : undefined,
    status: outcome.status,
    value: outcome.status === "success" ? outcome.value : null,
  });
}

function createDebugValueResult(
  resolvePlan: RequestResolutionPlan,
): LookupResult {
  return {
    attemptedRoutes: [],
    route: resolvePlan.plannedRoute || "(none)",
    status: "success",
    value: resolvePlan.debugValue,
  };
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
    attemptedRoutes: [directResolution.route],
    route: directResolution.route,
    status: "success",
    value: directResolution.value,
  };
}

function resolveIdentifierPlanLookup(
  requestInput: RequestInput,
  resolvePlan: RequestResolutionPlan,
): ResolvedQuoteLookup {
  const identifierPlan = resolvePlan.identifierPlan;

  if (!identifierPlan) {
    return {
      attributePlan: null,
      result: failureResult("(none)", [], "Identifier resolution failed."),
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
        [identifierRoute],
        identifierOutcome.error,
      ),
      resolvedRequest: null,
    };
  }

  const attributePlan = resolvePlan.buildAttributePlan
    ? resolvePlan.buildAttributePlan(identifierOutcome.value)
    : null;

  if (!attributePlan) {
    return {
      attributePlan: null,
      result: failureResult(
        identifierRoute,
        [identifierRoute],
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
      [identifierRoute],
    ),
    resolvedRequest: identifierOutcome.value,
  };
}

 
function finalizeLookupValue(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
  lookupResult: LookupResult,
  attributePlan?: ResolverPlanNode | null,
  resolvedRequest?: ResolvedRequest | null,
): LookupResult {
  if (lookupResult.status !== "success") {
    return lookupResult;
  }

  const attemptedRoutes = lookupResult.attemptedRoutes.slice();
  const quote = {
    ...((lookupResult.value || {}) as Record<string, unknown>),
  };
 
  try {
    const fxResult =
      attributePlan &&
      typeof (
        attributePlan as ResolverPlanNode & {
          resolveOutputCurrencyResult?: (
            request: RequestInput,
            value: Record<string, unknown>,
          ) => LookupResult | null;
        }
      ).resolveOutputCurrencyResult === "function"
        ? (
            attributePlan as ResolverPlanNode & {
              resolveOutputCurrencyResult(
                request: RequestInput,
                value: Record<string, unknown>,
              ): LookupResult | null;
            }
          ).resolveOutputCurrencyResult(requestInput, quote)
        : null;

    if (fxResult) {
      attemptedRoutes.push(...fxResult.attemptedRoutes);
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
              sourceOverride: requestInput.sourceOverride,
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
      attemptedRoutes,
      value,
    };
  } catch (error) {
    return failureResult(lookupResult.route, attemptedRoutes, error);
  }
}

export function resolveRequestValue(
  env: RequestResolutionDependencies,
  requestInput: RawRequestInput | RequestInput,
): LookupResult {
  const normalizedRequestInput = normalizeRequestInput(env, requestInput);

  try {
    validateDeferredLookupModes(normalizedRequestInput);
  } catch (error) {
    return failureResult("(none)", [], error);
  }

  try {
    const directResult = tryResolveDirectIsinValue(env, normalizedRequestInput);

    if (directResult) {
      return directResult;
    }
  } catch (error) {
    return failureResult("(none)", [], error);
  }

  let resolvePlan: Readonly<ResolvePlan> | null = null;

  try {
    resolvePlan = env.buildResolvePlan(normalizedRequestInput);
  } catch (error) {
    return failureResult("(none)", [], error);
  }

  if (resolvePlan.debugValue) {
    return createDebugValueResult(resolvePlan);
  }

  let effectiveAttributePlan = resolvePlan.attributePlan || null;
  let effectiveResolvedRequest = resolvePlan.resolvedRequest || null;
  const lookupResult =
    effectiveAttributePlan && effectiveResolvedRequest
      ? resolvePlannedQuoteResult(
          effectiveAttributePlan,
          effectiveResolvedRequest,
          [],
        )
      : resolvePlan.identifierPlan
        ? (() => {
            const identifierLookup = resolveIdentifierPlanLookup(
              normalizedRequestInput,
              resolvePlan,
            );
            effectiveAttributePlan = identifierLookup.attributePlan;
            effectiveResolvedRequest = identifierLookup.resolvedRequest;
            return identifierLookup.result;
          })()
        : failureResult(
            resolvePlan.plannedRoute || "(none)",
            [],
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
