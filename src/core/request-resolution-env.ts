import { resolveRoutingNode } from "./plan-navigation";
import { buildAmbiguousDefaultAttributeRouteError } from "./plan-selection";
import type {
  ResolutionResult,
  ResolverPlanNode,
} from "./planner";
import {
  RawRequestInput,
  type RequestInput,
  type ResolvedRequest,
} from "./request";
import type {
  LookupExecutionSelection,
  RequestResolutionDependencies,
} from "./request-resolution";
import type { ResolverServices } from "./resolver-services";

interface RequestResolutionRuntimeRefs {
  defaultAttributeRoot: ResolverPlanNode;
  directIdentifierResolver: {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  };
  identifierRootPlan: ResolverPlanNode;
  rootPlan: ResolverPlanNode;
}

interface RequestResolutionEnvBuilderDependencies {
  looksLikeIsin(value: string): boolean;
  resolverServices?: ResolverServices;
}

function classifyRawRequest(
  rootPlan: ResolverPlanNode,
  requestInput: RawRequestInput,
): ReturnType<
  NonNullable<RequestResolutionDependencies["classifyRawRequest"]>
> {
  const resolvedNode = resolveRoutingNode(
    rootPlan,
    requestInput,
  );

  if (!resolvedNode || typeof resolvedNode.resolve !== "function") {
    throw new Error("Request classification failed.");
  }

  const outcome = resolvedNode.resolve(requestInput);

  if (outcome.status !== "success") {
    throw new Error(outcome.error || "Request classification failed.");
  }

  return outcome.value as ReturnType<
    NonNullable<RequestResolutionDependencies["classifyRawRequest"]>
  >;
}

function buildDefaultAttributePlan(
  defaultAttributeRoot: ResolverPlanNode,
  resolvedRequest: ResolvedRequest,
): ResolverPlanNode {
  const candidatePlans = (defaultAttributeRoot.nodes || []).filter(
    (plan) => !plan.canHandle || plan.canHandle(resolvedRequest),
  ) as ResolverPlanNode[];

  if (!candidatePlans.length) {
    throw new Error("No attribute route is available for this request.");
  }

  if (candidatePlans.length > 1) {
    throw buildAmbiguousDefaultAttributeRouteError(
      resolvedRequest,
      candidatePlans,
    );
  }

  return candidatePlans[0] as ResolverPlanNode;
}

function selectLookupExecution(
  refs: RequestResolutionRuntimeRefs,
  requestInput: RequestInput,
): LookupExecutionSelection {
  const outcome = refs.directIdentifierResolver.resolve(requestInput);
  const resolvedRequest = outcome.status === "success" ? outcome.value : null;

  if (resolvedRequest) {
    return {
      attributePlan: buildDefaultAttributePlan(
        refs.defaultAttributeRoot,
        resolvedRequest,
      ),
      buildAttributePlan: null,
      identifierPlan: null,
      resolvedRequest,
    };
  }

  return {
    attributePlan: null,
    buildAttributePlan(resolvedIdentifierRequest) {
      return buildDefaultAttributePlan(
        refs.defaultAttributeRoot,
        resolvedIdentifierRequest,
      );
    },
    identifierPlan: resolveRoutingNode(
      refs.identifierRootPlan,
      requestInput,
      {
        allowNone: true,
      },
    ) as ResolverPlanNode | null,
    resolvedRequest: null,
  };
}

export function createRequestResolutionEnv(
  refs: RequestResolutionRuntimeRefs,
  deps: RequestResolutionEnvBuilderDependencies,
): RequestResolutionDependencies {
  const resolverServices = deps.resolverServices || null;

  return {
    classifyRawRequest: (requestInput) =>
      classifyRawRequest(refs.rootPlan, requestInput),
    getCachedString: (cacheKey) =>
      typeof resolverServices?.getCachedString === "function"
        ? resolverServices.getCachedString(cacheKey)
        : "",
    httpFetch: (url) => {
      if (typeof resolverServices?.httpFetch !== "function") {
        throw new Error(
          `ResolveFlow requires resolverServices.httpFetch to fetch "${url}".`,
        );
      }

      return resolverServices.httpFetch(url);
    },
    looksLikeIsin: deps.looksLikeIsin,
    putCachedString: (cacheKey, value, ttlSeconds) =>
      typeof resolverServices?.putCachedString === "function"
        ? resolverServices.putCachedString(
            cacheKey,
            value,
            Number.isFinite(ttlSeconds) ? Number(ttlSeconds) : 0,
          )
        : String(value || ""),
    selectLookupExecution: (requestInput) =>
      selectLookupExecution(refs, requestInput),
  };
}
