import type {
  ResolvePlan,
  ResolutionResult,
  ResolverPlanNode,
} from "./planner";
import type { RequestInput, ResolvedRequest } from "./request";
import { extractIsinFromRequestInput } from "./request-building";
import { resolveIsinAttributeValue } from "./isin-lookup";
import { extractAttributeValue } from "./attribute-extraction";
import { buildSourceOverrideUnavailableError } from "./plan-selection";

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
  fetchText(url: string): string;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
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

function resolvePlannedQuoteEnvelope(
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
): LookupEnvelopeResult {
  if (envelope.status !== "success") {
    return envelope;
  }

  try {
    const value =
      requestInput.attributeType === "isin"
        ? resolveIsinAttributeValue(
            (envelope.value || {}) as Record<string, unknown>,
            {
              sourceOverride: requestInput.sourceOverride,
              tickerInput: requestInput.ticker,
            },
            {
              fetchText: env.fetchText,
              getCachedString: env.getCachedString,
              looksLikeIsin: env.looksLikeIsin,
              putCachedString: env.putCachedString,
            },
          )
        : extractAttributeValue(
            (envelope.value || {}) as Record<string, unknown>,
            requestInput.attribute,
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
  const directIsin = extractIsinFromRequestInput(requestInput);

  if (requestInput.attributeType === "isin" && directIsin) {
    return {
      attemptedRoutes: ["DIRECT"],
      kind: "quote",
      route: "DIRECT",
      status: "success",
      value: directIsin,
    };
  }

  return projectLookupValue(
    env,
    requestInput,
    resolveRequestEnvelope(env, requestInput),
  );
}
