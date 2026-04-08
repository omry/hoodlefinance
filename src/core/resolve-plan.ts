import { createResolvePlan } from "./route-jobs";
import {
  buildForcedAttributePlanForResolvedRequest,
  buildIdentifierResolutionPlan,
  buildQuoteRoutePlanForResolvedRequest,
  buildSourceOverrideUnavailableError,
  type PlanSelectionDependencies,
} from "./plan-selection";
import { resolveRoutingNode } from "./plan-navigation";
import { FirstSuccessPlan } from "./resolver-classes";
import {
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";
import { createRequestInput, extractIsinFromRequestInput } from "./request-building";
import { looksLikeIsin } from "./request";
import type { ResolvePlan, ResolverNode, ResolverPlanNode } from "./planner";
import type { ResolutionResult } from "./planner";

export interface DefaultResolvePlanBuilderDependencies {
  directIdentifierResolver: {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  };
  getPlanNodeByCode(code: string): ResolverPlanNode;
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
  classifyRawRequest(input: RawRequestInput): RequestInput;
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

  return new FirstSuccessPlan(wrappedName, [node], {
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
  });
}

export function createDefaultResolvePlanBuilder(
  deps: DefaultResolvePlanBuilderDependencies,
): (requestInput: RawRequestInput | RequestInput) => Readonly<ResolvePlan> {
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
      getPlanNodeByCode: deps.getPlanNodeByCode,
    };

    const resolvePlanDeps: ResolvePlanDependencies = {
      buildForcedAttributePlanForResolvedRequest(input, request) {
        return wrapSelectedResolverNode(
          buildForcedAttributePlanForResolvedRequest(input, request, {
            buildForcedSelectedAttributePlan,
            getPlanNodeByCode: deps.getPlanNodeByCode,
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
            getPlanNodeByCode: deps.getPlanNodeByCode,
          }),
        );
      },
      buildRepresentativeForcedAttributeRequest(input) {
        return resolveIdentifierDirect(input);
      },
      buildSourceOverrideUnavailableError,
      classifyRawRequest(input) {
        const resolvedNode = resolveRoutingNode(
          deps.getPlanNodeByCode("ROOT"),
          input,
        );

        if (!resolvedNode || typeof resolvedNode.resolve !== "function") {
          throw new Error("Request classification failed.");
        }

        const outcome = resolvedNode.resolve(input);

        if (outcome.status !== "success") {
          throw new Error(outcome.error || "Request classification failed.");
        }

        return outcome.value as RequestInput;
      },
      createRequestInput,
      listSupportedSourcesForRequest() {
        return "";
      },
      resolveIdentifierDirect,
      validateNonQuoteSourceOverride() {},
    };

    return resolvePlanDeps;
  }

  return function buildDefaultResolvePlan(
    requestInput: RawRequestInput | RequestInput,
  ): Readonly<ResolvePlan> {
    return buildResolvePlan(requestInput, buildResolvePlanDependencies());
  };
}

function normalizeSourceOverride(requestInput: RequestInput): string {
  return String(requestInput.sourceOverride || "")
    .trim()
    .toUpperCase();
}

export function buildResolvePlan(
  requestInput: RawRequestInput | RequestInput,
  deps: ResolvePlanDependencies,
): Readonly<ResolvePlan> {
  const normalizedRequestInput =
    requestInput instanceof RawRequestInput
      ? deps.classifyRawRequest(requestInput)
      : requestInput;
  const nonInfoRequestInput = normalizedRequestInput.infoMode
    ? deps.createRequestInput(
        normalizedRequestInput.ticker,
        normalizedRequestInput.attribute,
      )
    : normalizedRequestInput;
  const infoMode = normalizedRequestInput.infoMode;
  const sourceOverride = normalizeSourceOverride(normalizedRequestInput);
  const hasForcedQuoteSource =
    normalizedRequestInput.attributeType === "quote" &&
    !!normalizedRequestInput.sourceOverride;
  const resolvedRequest = deps.resolveIdentifierDirect(normalizedRequestInput);
  const representativeForcedAttributeRequest = hasForcedQuoteSource
    ? deps.buildRepresentativeForcedAttributeRequest(normalizedRequestInput)
    : null;

  if (infoMode === "source-list") {
    return createResolvePlan({
      debugValue: deps.listSupportedSourcesForRequest(nonInfoRequestInput),
      plannedRoute: buildResolvePlan(nonInfoRequestInput, deps).plannedRoute,
      requestInput: normalizedRequestInput,
    });
  }

  if (infoMode === "source-name") {
    return createResolvePlan({
      debugValue: buildResolvePlan(
        deps.createRequestInput(
          normalizedRequestInput.ticker,
          normalizedRequestInput.attribute,
        ),
        deps,
      ).plannedRoute,
      requestInput: normalizedRequestInput,
    });
  }

  deps.validateNonQuoteSourceOverride(normalizedRequestInput, resolvedRequest);

  if (
    hasForcedQuoteSource &&
    !resolvedRequest &&
    !representativeForcedAttributeRequest
  ) {
    throw deps.buildSourceOverrideUnavailableError(sourceOverride);
  }

  if (resolvedRequest) {
    const attributePlan = deps.buildQuoteRoutePlanForResolvedRequest(
      normalizedRequestInput,
      resolvedRequest,
    );

    return createResolvePlan({
      attributePlan,
      plannedRoute: attributePlan.describe(resolvedRequest),
      requestInput: normalizedRequestInput,
      resolvedRequest,
    });
  }

  const identifierPlan =
    deps.buildIdentifierResolutionPlan(normalizedRequestInput);

  if (!identifierPlan) {
    throw new Error("Identifier resolution failed.");
  }

  return createResolvePlan({
    buildAttributePlan(resolvedIdentifierRequest) {
      return deps.buildQuoteRoutePlanForResolvedRequest(
        normalizedRequestInput,
        resolvedIdentifierRequest,
      );
    },
    identifierPlan,
    plannedRoute: hasForcedQuoteSource
      ? representativeForcedAttributeRequest
        ? `${identifierPlan.describe(normalizedRequestInput)} => ${deps
            .buildForcedAttributePlanForResolvedRequest(
              normalizedRequestInput,
              representativeForcedAttributeRequest,
            )
            .describe(representativeForcedAttributeRequest)}`
        : identifierPlan.describe(normalizedRequestInput)
      : identifierPlan.describe(normalizedRequestInput),
    requestInput: normalizedRequestInput,
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
