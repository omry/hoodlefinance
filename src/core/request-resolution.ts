import type { ResolutionResult } from "./planner";
import {
  resolveQuoteForResolvedRequest,
  type QuoteRoutingDependencies,
  type QuoteRoutingPlanLike,
} from "./quote-routing";
import type { RequestInput, ResolvedRequest } from "./request";
import {
  buildTypedRequestFromParsedInput,
  extractIsinFromRequestInput,
} from "./request-building";
import { resolveIsinAttributeValue } from "./isin-lookup";
import { extractAttributeValue } from "./attribute-extraction";

export interface IdentifierPlanLike {
  describe(request: RequestInput): string;
  resolve(request: RequestInput): ResolutionResult<ResolvedRequest>;
}

export interface DirectIdentifierResolverLike {
  name: string;
  resolve(request: RequestInput): ResolutionResult<ResolvedRequest>;
}

export interface RequestResolutionDependencies
  extends Omit<QuoteRoutingDependencies, "identifierIsinPlan"> {
  directIdentifierResolver: DirectIdentifierResolverLike;
  fetchText(url: string): string;
  getCachedString(cacheKey: string): string;
  identifierIsinPlan?: IdentifierPlanLike;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
  quoteEquityPlan?: QuoteRoutingPlanLike;
  quoteFxPlan?: QuoteRoutingPlanLike;
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

function resolveQuoteEnvelope(
  env: RequestResolutionDependencies,
  resolvedRequest: ResolvedRequest,
  attemptedRoutes: string[],
): LookupEnvelopeResult {
  const { identifierIsinPlan: _identifierIsinPlan, ...quoteRoutingEnv } = env;
  const result = resolveQuoteForResolvedRequest(
    quoteRoutingEnv,
    resolvedRequest,
    attemptedRoutes,
  );
  const route =
    result.route != null
      ? String(result.route)
      : attemptedRoutes[attemptedRoutes.length - 1] || "(none)";
  const status = result.status === "success" ? "success" : "failure";

  const normalizedResult: LookupEnvelopeResult = {
    attemptedRoutes: result.attemptedRoutes || attemptedRoutes,
    kind: "quote",
    route,
    status,
    value:
      status === "success" &&
      Object.prototype.hasOwnProperty.call(result, "value")
        ? (result as { value?: unknown }).value
        : null,
  };

  if (result.error != null) {
    normalizedResult.error = String(
      result.error instanceof Error ? result.error.message : result.error,
    );
  }

  return normalizedResult;
}

function resolveIdentifierPlanEnvelope(
  env: RequestResolutionDependencies,
  requestInput: RequestInput,
  identifierPlan: IdentifierPlanLike,
): LookupEnvelopeResult {
  const identifierRoute = identifierPlan.describe(requestInput);
  const identifierOutcome = identifierPlan.resolve(requestInput);

  if (identifierOutcome.status !== "success") {
    return failureResult(
      identifierRoute,
      [identifierRoute],
      identifierOutcome.error,
    );
  }

  return resolveQuoteEnvelope(env, identifierOutcome.value, [identifierRoute]);
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
  const directIsin = extractIsinFromRequestInput(requestInput);

  if (requestInput.classification === "fx" && requestInput.fxPair) {
    return resolveQuoteEnvelope(
      env,
      buildTypedRequestFromParsedInput(requestInput, requestInput, 0),
      [],
    );
  }

  if (directIsin && env.identifierIsinPlan) {
    return resolveIdentifierPlanEnvelope(env, requestInput, env.identifierIsinPlan);
  }

  const directOutcome = env.directIdentifierResolver.resolve(requestInput);
  const directRoute = env.directIdentifierResolver.name;

  if (directOutcome.status === "success") {
    return resolveQuoteEnvelope(env, directOutcome.value, [directRoute]);
  }

  if (directIsin && env.identifierIsinPlan) {
    return resolveIdentifierPlanEnvelope(env, requestInput, env.identifierIsinPlan);
  }

  return failureResult(directRoute, [directRoute], directOutcome.error);
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
