import { createResolvePlan } from "./route-jobs";
import {
  buildForcedAttributePlanForResolvedRequest,
  buildIdentifierResolutionPlan,
  buildQuoteRoutePlanForResolvedRequest,
  buildSourceOverrideUnavailableError,
  type PlanSelectionDependencies,
} from "./plan-selection";
import { FirstSuccessPlan, type ResolverPlanOptions } from "./resolver-classes";
import type { PlanRuntimeRefs } from "./plan-runtime-refs";
import {
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";
import { createRequestInput, extractIsinFromRequestInput } from "./request-building";
import { looksLikeIsin } from "./request";
import type { ResolvePlan, ResolverNode, ResolverPlanNode } from "./planner";
import type { ResolutionResult } from "./planner";
import { resolveRoutingNode } from "./plan-navigation";

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
  enterRequestInput(input: RawRequestInput): RequestInput;
  createRequestInput(identifier: string, attribute: string): RequestInput;
  listSupportedSourcesForRequest(input: RequestInput): string;
  resolveIdentifierDirect(input: RequestInput): ResolvedRequest | null;
  validateNonQuoteSourceOverride(
    requestInput: RequestInput,
    resolvedRequest: ResolvedRequest | null,
  ): void;
}

function wrapSelectedResolverNode(
  node: ResolverNode,
  parentPlan?: ResolverPlanNode | null,
): ResolverPlanNode {
  const wrappedName = String((node && node.name) || "").trim();
  const refs =
    parentPlan &&
    typeof parentPlan === "object" &&
    "refs" in parentPlan &&
    (parentPlan as { refs?: PlanRuntimeRefs | null }).refs
      ? ((parentPlan as { refs?: PlanRuntimeRefs | null }).refs as PlanRuntimeRefs)
      :
    node &&
    typeof node === "object" &&
    "refs" in node &&
    (node as { refs?: PlanRuntimeRefs | null }).refs
      ? ((node as { refs?: PlanRuntimeRefs | null }).refs as PlanRuntimeRefs)
      : null;
  const options: ResolverPlanOptions = {
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
  };

  return refs
    ? new FirstSuccessPlan(wrappedName, [node], refs, options)
    : new FirstSuccessPlan(wrappedName, [node], options);
}

export function createDefaultResolvePlanBuilder(
  deps: DefaultResolvePlanBuilderDependencies,
): (requestInput: RawRequestInput) => Readonly<ResolvePlan> {
  function resolveIdentifierDirect(
    requestInput: RequestInput,
  ): ResolvedRequest | null {
    const outcome = deps.directIdentifierResolver.resolve(requestInput);

    return outcome && outcome.status === "success" ? outcome.value : null;
  }

  function buildSelectedIdentifierPlan(
    resolverOrPlan: ResolverNode,
    _request: RequestInput,
    parentPlan?: ResolverPlanNode | null,
  ): ResolverPlanNode {
    return wrapSelectedResolverNode(resolverOrPlan, parentPlan);
  }

  function buildForcedSelectedAttributePlan(
    resolverOrPlan: ResolverNode,
    _request: ResolvedRequest,
    parentPlan?: ResolverPlanNode | null,
  ): ResolverPlanNode {
    return wrapSelectedResolverNode(resolverOrPlan, parentPlan);
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
      enterRequestInput(input) {
        const resolvedNode = resolveRoutingNode(
          deps.getPlanNodeByCode("ROOT"),
          input,
        );

        if (!resolvedNode || typeof resolvedNode.resolve !== "function") {
          throw new Error("Request entry failed.");
        }

        const outcome = resolvedNode.resolve(input);

        if (outcome.status !== "success") {
          throw new Error(outcome.error || "Request entry failed.");
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
    requestInput: RawRequestInput,
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
  requestInput: RawRequestInput,
  deps: ResolvePlanDependencies,
): Readonly<ResolvePlan> {
  const normalizedRequestInput = deps.enterRequestInput(requestInput);

  return buildResolvePlanForRequestInput(normalizedRequestInput, deps);
}

function buildResolvePlanForRequestInput(
  requestInput: RequestInput,
  deps: ResolvePlanDependencies,
): Readonly<ResolvePlan> {
  const nonInfoRequestInput = requestInput.infoMode
    ? deps.createRequestInput(
        requestInput.ticker,
        requestInput.attribute,
      )
    : requestInput;
  const infoMode = requestInput.infoMode;
  const sourceOverride = normalizeSourceOverride(requestInput);
  const hasForcedQuoteSource =
    requestInput.attributeType === "quote" &&
    !!requestInput.sourceOverride;
  const resolvedRequest = deps.resolveIdentifierDirect(requestInput);
  const representativeForcedAttributeRequest = hasForcedQuoteSource
    ? deps.buildRepresentativeForcedAttributeRequest(requestInput)
    : null;

  if (infoMode === "source-list") {
    return createResolvePlan({
      debugValue: deps.listSupportedSourcesForRequest(nonInfoRequestInput),
      plannedRoute: buildResolvePlanForRequestInput(
        nonInfoRequestInput,
        deps,
      ).plannedRoute,
      requestInput,
    });
  }

  if (infoMode === "source-name") {
    return createResolvePlan({
      debugValue: buildResolvePlanForRequestInput(
        deps.createRequestInput(
          requestInput.ticker,
          requestInput.attribute,
        ),
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
    new RawRequestInput(String(ticker).trim(), attribute),
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
