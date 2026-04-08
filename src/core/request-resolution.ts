import type {
  ResolvePlan,
  ResolutionResult,
  ResolverPlanNode,
} from "./planner";
import type { FxPair, RequestInput, ResolvedRequest } from "./request";
import { buildFxPairFromCodes } from "./fx-normalization";
import {
  resolveDirectIsinAttributeValue,
  resolveIsinAttributeValue,
} from "./isin-lookup";
import {
  extractAttributeValue,
  parseAttributeRequest,
  extractCurrencyValue,
} from "./attribute-extraction";
import { buildSourceOverrideUnavailableError } from "./plan-selection";
import { createRequestInput } from "./request-building";

interface QuotePlanOutcome {
  error?: unknown;
  status: "failure" | "success";
  value?: unknown;
}

interface ResolvablePlanLike<TRequest, TValue> {
  describe(request: TRequest): string;
  resolve(request: TRequest): ResolutionResult<TValue>;
}

interface RequestResolutionPlanLike {
  buildAttributePlan:
    | ((resolvedIdentifierRequest: ResolvedRequest) => ResolverPlanNode | null)
    | null;
  debugValue: string;
  identifierPlan: ResolverPlanNode | null;
  plannedRoute: string;
  requestInput: RequestInput;
  resolvedRequest: ResolvedRequest | null;
}

export interface RequestResolutionDependencies {
  buildResolvePlan(requestInput: RequestInput): Readonly<ResolvePlan>;
  httpFetch(url: string): string;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
  resolveFxRate(fxPair: FxPair): LookupEnvelopeResult;
}

export interface LookupEnvelopeResult {
  attemptedRoutes: string[];
  error?: string;
  kind: "quote";
  route: string;
  status: "failure" | "success";
  value: unknown;
}

function failureResult(
  route: string,
  attemptedRoutes: string[],
  error: unknown,
): LookupEnvelopeResult {
  return {
    attemptedRoutes,
    error: error instanceof Error ? error.message : String(error || ""),
    kind: "quote",
    route,
    status: "failure",
    value: null,
  };
}

function normalizePlanOutcome(
  route: string,
  attemptedRoutes: string[],
  outcome: QuotePlanOutcome,
): LookupEnvelopeResult {
  const normalized: LookupEnvelopeResult = {
    attemptedRoutes,
    kind: "quote",
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
): ResolvablePlanLike<TRequest, TValue> {
  if (!plan || typeof plan.resolve !== "function") {
    throw new Error(errorMessage);
  }

  return plan as ResolvablePlanLike<TRequest, TValue>;
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

export function resolvePlannedQuoteEnvelope(
  attributePlan: ResolverPlanNode,
  resolvedRequest: ResolvedRequest,
  attemptedRoutes: string[],
): LookupEnvelopeResult {
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

function resolveIdentifierPlanEnvelope(
  requestInput: RequestInput,
  resolvePlan: RequestResolutionPlanLike,
): LookupEnvelopeResult {
  const identifierPlan = resolvePlan.identifierPlan;

  if (!identifierPlan) {
    return failureResult("(none)", [], "Identifier resolution failed.");
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
    return failureResult(
      identifierRoute,
      [identifierRoute],
      identifierOutcome.error,
    );
  }

  const attributePlan = resolvePlan.buildAttributePlan
    ? resolvePlan.buildAttributePlan(identifierOutcome.value)
    : null;

  if (!attributePlan) {
    return failureResult(
      identifierRoute,
      [identifierRoute],
      "No attribute route is available for this request.",
    );
  }

  return resolvePlannedQuoteEnvelope(
    attributePlan,
    identifierOutcome.value,
    [identifierRoute],
  );
}

 
function projectLookupValue(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
  envelope: LookupEnvelopeResult,
  resolvePlan?: Readonly<ResolvePlan> | null,
): LookupEnvelopeResult {
  if (envelope.status !== "success") {
    return envelope;
  }
 
  const quote = (envelope.value || {}) as Record<string, unknown>;
 
  try {
    const attributeRequest = parseAttributeRequest(requestInput.attribute);
 
    if (
      requestInput.attributeType === "quote" &&
      attributeRequest.wantsOutputCurrency &&
      attributeRequest.baseAttribute === "price"
    ) {
      const sourceCurrency = extractCurrencyValue(quote);
      const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();
 
      if (
        sourceCurrency &&
        targetCurrency &&
        sourceCurrency !== targetCurrency &&
        (quote.hoodlefinanceFxUnitScale == null ||
          !Number.isFinite(Number(quote.hoodlefinanceFxUnitScale)))
      ) {
        const fxPair = buildFxPairFromCodes(sourceCurrency, targetCurrency);
        if (!fxPair) {
          throw new Error(
            `Output-currency conversion from "${sourceCurrency}" to "${targetCurrency}" is not supported. Use recognized 3- or 4-character currency codes.`,
          );
        }

        const fxEnvelope = env.resolveFxRate(fxPair);
        envelope.attemptedRoutes = envelope.attemptedRoutes.concat(
          fxEnvelope.attemptedRoutes,
        );
        if (fxEnvelope.status === "success") {
          const rate = Number(fxEnvelope.value);
          if (Number.isFinite(rate)) {
            quote.hoodlefinanceFxUnitScale = rate;
          }
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
              fetchText: env.httpFetch,
              getCachedString: env.getCachedString,
              looksLikeIsin: env.looksLikeIsin,
              putCachedString: env.putCachedString,
            },
          )
        : extractAttributeValue(
            quote,
            requestInput.attribute,
            resolvePlan &&
              resolvePlan.attributePlan &&
              resolvePlan.resolvedRequest &&
              typeof resolvePlan.attributePlan.buildRuntimePlan === "function"
              ? {
                  routeState:
                    resolvePlan.attributePlan.buildRuntimePlan(
                      resolvePlan.resolvedRequest,
                    ).routeState || null,
                  tickerInput: requestInput.ticker,
                }
              : {
                  tickerInput: requestInput.ticker,
                },
          );
 
    return {
      ...envelope,
      value,
    };
  } catch (error) {
    return failureResult(envelope.route, envelope.attemptedRoutes, error);
  }
}

export function resolveRequestEnvelope(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
): LookupEnvelopeResult {
  let resolvePlan: Readonly<ResolvePlan>;

  try {
    validateDeferredLookupModes(requestInput);
    resolvePlan = env.buildResolvePlan(requestInput);
  } catch (error) {
    return failureResult("(none)", [], error);
  }

  if (resolvePlan.debugValue) {
    return {
      attemptedRoutes: [],
      kind: "quote",
      route: resolvePlan.plannedRoute || "(none)",
      status: "success",
      value: resolvePlan.debugValue,
    };
  }

  if (resolvePlan.attributePlan && resolvePlan.resolvedRequest) {
    return resolvePlannedQuoteEnvelope(
      resolvePlan.attributePlan,
      resolvePlan.resolvedRequest,
      [],
    );
  }

  if (resolvePlan.identifierPlan) {
    return resolveIdentifierPlanEnvelope(requestInput, resolvePlan);
  }

  return failureResult(
    resolvePlan.plannedRoute || "(none)",
    [],
    "Identifier resolution failed.",
  );
}

export function resolveRequestValue(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
): LookupEnvelopeResult {
  if (requestInput.attributeType === "isin") {
    try {
      validateDeferredLookupModes(requestInput);

      const directResolution = resolveDirectIsinAttributeValue(
        {
          tickerInput: requestInput.ticker,
        },
        {
          fetchText: env.httpFetch,
          getCachedString: env.getCachedString,
          looksLikeIsin: env.looksLikeIsin,
          putCachedString: env.putCachedString,
        },
      );

      if (directResolution) {
        return {
          attemptedRoutes: [directResolution.route],
          kind: "quote",
          route: directResolution.route,
          status: "success",
          value: directResolution.value,
        };
      }
    } catch (error) {
      return failureResult("(none)", [], error);
    }
  }

  let resolvePlan: Readonly<ResolvePlan> | null = null;

  try {
    validateDeferredLookupModes(requestInput);
    resolvePlan = env.buildResolvePlan(requestInput);
  } catch (error) {
    return failureResult("(none)", [], error);
  }

  if (resolvePlan.debugValue) {
    return {
      attemptedRoutes: [],
      kind: "quote",
      route: resolvePlan.plannedRoute || "(none)",
      status: "success",
      value: resolvePlan.debugValue,
    };
  }

  const envelope =
    resolvePlan.attributePlan && resolvePlan.resolvedRequest
      ? resolvePlannedQuoteEnvelope(
          resolvePlan.attributePlan,
          resolvePlan.resolvedRequest,
          [],
        )
      : resolvePlan.identifierPlan
        ? resolveIdentifierPlanEnvelope(requestInput, resolvePlan)
        : failureResult(
            resolvePlan.plannedRoute || "(none)",
            [],
            "Identifier resolution failed.",
          );

  return projectLookupValue(env, requestInput, envelope, resolvePlan);
}
