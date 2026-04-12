import { createResolvePlan } from "./route-jobs";
import {
  buildIdentifierResolutionPlan,
  buildQuoteRoutePlanForResolvedRequest,
  type PlanSelectionDependencies,
} from "./plan-selection";
import { extractTickerSourceOverride } from "./request-parsing";
import { FirstSuccessPlan, type ResolverPlanOptions } from "./resolver-classes";
import type { PlanRuntimeRefs } from "./plan-runtime-refs";
import {
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";
import { createRequestInput, extractIsinFromRequestInput } from "./request-building";
import { looksLikeIsin } from "./request";
import type { ResolvePlan, ResolutionResult } from "./planner";
import type { Resolver, ResolverPlan } from "./resolver-classes";

export interface DefaultResolvePlanBuilderDependencies {
  directIdentifierResolver: {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  };
  getRootNode(): Resolver;
  getPlanNodeByCode(code: string): ResolverPlan;
}

export interface ResolvePlanDependencies {
  buildIdentifierResolutionPlan(input: RequestInput): ResolverPlan | null;
  buildQuoteRoutePlanForResolvedRequest(
    input: RequestInput,
    request: ResolvedRequest,
  ): ResolverPlan;
  enterRequestInput(input: RawRequestInput): RequestInput;
  createRequestInput(identifier: string, attribute: string): RequestInput;
  listSupportedSourcesForRequest(input: RequestInput): string;
  resolveIdentifierDirect(input: RequestInput): ResolvedRequest | null;
}

function wrapSelectedResolver(
  node: Resolver,
  parentPlan?: ResolverPlan | null,
): ResolverPlan {
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
    resolverOrPlan: Resolver,
    _request: RequestInput,
    parentPlan?: ResolverPlan | null,
  ): ResolverPlan {
    return wrapSelectedResolver(resolverOrPlan, parentPlan);
  }

  function buildResolvePlanDependencies() {
    const planSelectionDeps: PlanSelectionDependencies = {
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
      buildIdentifierResolutionPlan(input) {
        return buildIdentifierResolutionPlan(input, planSelectionDeps);
      },
      buildQuoteRoutePlanForResolvedRequest(input, request) {
        return wrapSelectedResolver(
          buildQuoteRoutePlanForResolvedRequest(input, request, {
            getPlanNodeByCode: deps.getPlanNodeByCode,
          }),
        );
      },
      enterRequestInput(input) {
        const resolvedNode = deps.getRootNode();

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
    };

    return resolvePlanDeps;
  }

  return function buildDefaultResolvePlan(
    requestInput: RawRequestInput,
  ): Readonly<ResolvePlan> {
    return buildResolvePlan(requestInput, buildResolvePlanDependencies());
  };
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
  const resolvedRequest = deps.resolveIdentifierDirect(requestInput);

  if (infoMode === "source-override") {
    throw new Error(
      `"@${extractTickerSourceOverride(requestInput.identifier)}" is not available for this request.`,
    );
  }

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
    plannedRoute: identifierPlan.describe(requestInput),
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
  nodes: Resolver[];
  routeClass: string;
  routePath: string;
  routeState: Record<string, unknown>;
}
