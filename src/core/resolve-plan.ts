import { createResolvePlan } from "./route-jobs";
import type { RequestInput, ResolvedRequest } from "./request";
import type { ResolvePlan, ResolverNode, ResolverPlanNode } from "./planner";

export interface ResolvePlanDependencies {
  buildForcedAttributePlanForResolvedRequest(
    input: RequestInput,
    request: ResolvedRequest,
  ): ResolverPlanNode;
  buildIdentifierResolutionPlan(input: RequestInput): ResolverPlanNode | null;
  buildQuoteRoutePlanForResolvedRequest(
    input: RequestInput,
    request: ResolvedRequest,
  ): ResolverPlanNode;
  buildRepresentativeForcedAttributeRequest(
    input: RequestInput,
  ): ResolvedRequest | null;
  buildSourceOverrideUnavailableError(
    sourceOverride: string,
    contextLabel?: string,
  ): Error;
  createRequestInput(identifier: string, attribute: string): RequestInput;
  listSupportedSourcesForRequest(input: RequestInput): string;
  resolveIdentifierDirect(input: RequestInput): ResolvedRequest | null;
  validateNonQuoteSourceOverride(
    requestInput: RequestInput,
    resolvedRequest: ResolvedRequest | null,
  ): void;
}

function normalizeSourceOverride(requestInput: RequestInput): string {
  return String(requestInput.sourceOverride || "")
    .trim()
    .toUpperCase();
}

export function buildResolvePlan(
  requestInput: RequestInput,
  deps: ResolvePlanDependencies,
): Readonly<ResolvePlan> {
  const nonInfoRequestInput = requestInput.infoMode
    ? deps.createRequestInput(requestInput.ticker, requestInput.attribute)
    : requestInput;
  const infoMode = requestInput.infoMode;
  const sourceOverride = normalizeSourceOverride(requestInput);
  const hasForcedQuoteSource =
    requestInput.attributeType === "quote" && !!requestInput.sourceOverride;
  const resolvedRequest = deps.resolveIdentifierDirect(requestInput);
  const representativeForcedAttributeRequest = hasForcedQuoteSource
    ? deps.buildRepresentativeForcedAttributeRequest(requestInput)
    : null;

  if (infoMode === "source-list") {
    return createResolvePlan({
      debugValue: deps.listSupportedSourcesForRequest(nonInfoRequestInput),
      plannedRoute: buildResolvePlan(nonInfoRequestInput, deps).plannedRoute,
      requestInput,
    });
  }

  if (infoMode === "source-name") {
    return createResolvePlan({
      debugValue: buildResolvePlan(
        deps.createRequestInput(requestInput.ticker, requestInput.attribute),
        deps,
      ).plannedRoute,
      requestInput,
    });
  }

  deps.validateNonQuoteSourceOverride(requestInput, resolvedRequest);

  if (
    hasForcedQuoteSource &&
    !resolvedRequest &&
    !representativeForcedAttributeRequest
  ) {
    throw deps.buildSourceOverrideUnavailableError(sourceOverride);
  }

  if (resolvedRequest) {
    const attributePlan = deps.buildQuoteRoutePlanForResolvedRequest(
      requestInput,
      resolvedRequest,
    );

    return createResolvePlan({
      attributePlan,
      plannedRoute: attributePlan.describe(resolvedRequest),
      requestInput,
      resolvedRequest,
    });
  }

  const identifierPlan = deps.buildIdentifierResolutionPlan(requestInput);

  if (!identifierPlan) {
    throw new Error("Identifier resolution failed.");
  }

  return createResolvePlan({
    buildAttributePlan(resolvedIdentifierRequest) {
      return deps.buildQuoteRoutePlanForResolvedRequest(
        requestInput,
        resolvedIdentifierRequest,
      );
    },
    identifierPlan,
    plannedRoute: hasForcedQuoteSource
      ? representativeForcedAttributeRequest
        ? `${identifierPlan.describe(requestInput)} => ${deps
            .buildForcedAttributePlanForResolvedRequest(
              requestInput,
              representativeForcedAttributeRequest,
            )
            .describe(representativeForcedAttributeRequest)}`
        : identifierPlan.describe(requestInput)
      : identifierPlan.describe(requestInput),
    requestInput,
  });
}

export function classifyTickerJob(
  ticker: string,
  attribute: string,
  deps: ResolvePlanDependencies,
): DebugRoutePlanLike | RuntimePlanLike | null {
  const resolvePlan = buildResolvePlan(
    deps.createRequestInput(String(ticker).trim(), attribute),
    deps,
  );

  if (resolvePlan.debugValue) {
    return { debugValue: resolvePlan.debugValue };
  }

  if (resolvePlan.attributePlan && resolvePlan.resolvedRequest) {
    return resolvePlan.attributePlan.buildRuntimePlan(
      resolvePlan.resolvedRequest,
    );
  }

  return resolvePlan.identifierPlan
    ? resolvePlan.identifierPlan.buildRuntimePlan(resolvePlan.requestInput)
    : null;
}

export interface DebugRoutePlanLike {
  debugValue: string;
}

export interface RuntimePlanLike {
  nodes: ResolverNode[];
  routeClass: string;
  routePath: string;
  routeState: Record<string, unknown>;
}
