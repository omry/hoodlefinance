import { resolveRoutingNode } from "./plan-navigation";
import { buildDefaultAttributePlanForResolvedRequest } from "./plan-selection";
import type {
  ResolutionResult,
  ResolverNode,
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

interface RequestResolutionNodeLookup {
  getNodeByCode(code: string): ResolverNode;
  getPlanNodeByCode(code: string): ResolverPlanNode;
}

interface RequestResolutionEnvBuilderDependencies {
  looksLikeIsin(value: string): boolean;
  resolverServices?: ResolverServices;
}

function classifyRawRequest(
  nodeLookup: RequestResolutionNodeLookup,
  requestInput: RawRequestInput,
): ReturnType<
  NonNullable<RequestResolutionDependencies["classifyRawRequest"]>
> {
  const resolvedNode = resolveRoutingNode(
    nodeLookup.getPlanNodeByCode("ROOT"),
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
  nodeLookup: RequestResolutionNodeLookup,
  resolvedRequest: ResolvedRequest,
): ResolverPlanNode {
  return buildDefaultAttributePlanForResolvedRequest(resolvedRequest, {
    getPlanNodeByCode: (code) => nodeLookup.getPlanNodeByCode(code),
  });
}

function selectLookupExecution(
  nodeLookup: RequestResolutionNodeLookup,
  directIdentifierResolver: {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  },
  requestInput: RequestInput,
): LookupExecutionSelection {
  const outcome = directIdentifierResolver.resolve(requestInput);
  const resolvedRequest = outcome.status === "success" ? outcome.value : null;

  if (resolvedRequest) {
    return {
      attributePlan: buildDefaultAttributePlan(nodeLookup, resolvedRequest),
      buildAttributePlan: null,
      identifierPlan: null,
      resolvedRequest,
    };
  }

  return {
    attributePlan: null,
    buildAttributePlan(resolvedIdentifierRequest) {
      return buildDefaultAttributePlan(nodeLookup, resolvedIdentifierRequest);
    },
    identifierPlan: resolveRoutingNode(
      nodeLookup.getPlanNodeByCode("IDENTIFIER-ROOT"),
      requestInput,
      {
        allowNone: true,
      },
    ) as ResolverPlanNode | null,
    resolvedRequest: null,
  };
}

export function createRequestResolutionEnv(
  nodeLookup: RequestResolutionNodeLookup,
  deps: RequestResolutionEnvBuilderDependencies,
): RequestResolutionDependencies {
  const directIdentifierResolver = nodeLookup.getNodeByCode(
    "RESOLVED-IDENTIFIER",
  ) as {
    resolve(requestInput: RequestInput): ResolutionResult<ResolvedRequest>;
  };
  const resolverServices = deps.resolverServices || null;

  return {
    classifyRawRequest: (requestInput) =>
      classifyRawRequest(nodeLookup, requestInput),
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
      selectLookupExecution(nodeLookup, directIdentifierResolver, requestInput),
  };
}
