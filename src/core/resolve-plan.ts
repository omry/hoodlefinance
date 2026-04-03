import { createResolvePlan } from "./route-jobs";
import {
  buildForcedAttributePlanForResolvedRequest,
  buildIdentifierResolutionPlan,
  buildQuoteRoutePlanForResolvedRequest,
  buildSourceOverrideUnavailableError,
  type PlanSelectionDependencies,
} from "./plan-selection";
import { ResolverPlan } from "./resolver-classes";
import type { RequestInput, ResolvedRequest } from "./request";
import { createRequestInput, extractIsinFromRequestInput } from "./request-building";
import { looksLikeIsin } from "./request";
import type { ResolvePlan, ResolverNode, ResolverPlanNode } from "./planner";
import type { ResolutionResult } from "./planner";

export interface DefaultResolvePlanBuilderDependencies {
  directIdentifierResolver: {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  };
  materializePlanFromSpec(code: string): ResolverPlanNode;
}

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

function wrapSelectedResolverNode(node: ResolverNode): ResolverPlanNode {
  const wrappedName = String((node && node.name) || "").trim();

  return new ResolverPlan(wrappedName, [node], {
    canHandle(request) {
      return !node || !node.canHandle ? true : node.canHandle(request);
    },
    routeClass(request) {
      return node && node.buildRuntimePlan
        ? node.buildRuntimePlan(request).routeClass
        : wrappedName;
    },
    routePath(request) {
      return node && node.buildRuntimePlan
        ? node.buildRuntimePlan(request).routePath
        : wrappedName;
    },
    routingDescription: node && node.routingDescription ? node.routingDescription : "",
    routingLabel: node && node.routingLabel ? node.routingLabel : "",
    sourceName: node && node.sourceName ? node.sourceName : "",
  });
}

export function createDefaultResolvePlanBuilder(
  deps: DefaultResolvePlanBuilderDependencies,
): (requestInput: RequestInput) => Readonly<ResolvePlan> {
  function resolveIdentifierDirect(
    requestInput: RequestInput,
  ): ResolvedRequest | null {
    const outcome = deps.directIdentifierResolver.resolve(requestInput);

    return outcome && outcome.status === "success" ? outcome.value : null;
  }

  function buildSelectedIdentifierPlan(
    resolverOrPlan: ResolverNode,
  ): ResolverPlanNode {
    return wrapSelectedResolverNode(resolverOrPlan);
  }

  function buildForcedSelectedAttributePlan(
    resolverOrPlan: ResolverNode,
  ): ResolverPlanNode {
    return wrapSelectedResolverNode(resolverOrPlan);
  }

  function buildResolvePlanDependencies() {
    const planSelectionDeps: PlanSelectionDependencies = {
      buildForcedSelectedAttributePlan,
      buildSelectedIdentifierPlan,
      extractIsinFromRequestInput(request) {
        return extractIsinFromRequestInput(request, looksLikeIsin);
      },
      listAllDefaultAttributePlans() {
        return [];
      },
      materializePlanFromSpec: deps.materializePlanFromSpec,
    };

    const resolvePlanDeps: ResolvePlanDependencies = {
      buildForcedAttributePlanForResolvedRequest(input, request) {
        return wrapSelectedResolverNode(
          buildForcedAttributePlanForResolvedRequest(input, request, {
            buildForcedSelectedAttributePlan,
            materializePlanFromSpec: deps.materializePlanFromSpec,
          }),
        );
      },
      buildIdentifierResolutionPlan(input) {
        return buildIdentifierResolutionPlan(input, planSelectionDeps);
      },
      buildQuoteRoutePlanForResolvedRequest(input, request) {
        return wrapSelectedResolverNode(
          buildQuoteRoutePlanForResolvedRequest(input, request, {
            buildForcedSelectedAttributePlan,
            materializePlanFromSpec: deps.materializePlanFromSpec,
          }),
        );
      },
      buildRepresentativeForcedAttributeRequest(input) {
        return resolveIdentifierDirect(input);
      },
      buildSourceOverrideUnavailableError,
      createRequestInput,
      listSupportedSourcesForRequest() {
        return "";
      },
      resolveIdentifierDirect,
      validateNonQuoteSourceOverride() {},
    };

    return resolvePlanDeps;
  }

  return function buildDefaultResolvePlan(requestInput: RequestInput): Readonly<ResolvePlan> {
    return buildResolvePlan(requestInput, buildResolvePlanDependencies());
  };
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
