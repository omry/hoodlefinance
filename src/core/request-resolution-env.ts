import { resolveRoutingNode } from "./plan-navigation";
import { buildAmbiguousDefaultAttributeRouteError } from "./plan-selection";
import type { ResolutionResult } from "./planner";
import type { ResolverPlan } from "./resolver-classes";
import {
  RawRequestInput,
  type ResolvedRequest,
} from "./request";
import type {
  LookupExecutionSelection,
  RequestResolutionDependencies,
} from "./request-resolution";
import type { ClassifiedInput } from "./concrete-resolvers";
import type { ResolverServices } from "./resolver-services";

interface RequestResolutionRuntimeRefs {
  defaultAttributeRoot: ResolverPlan;
  identifierPlan: ResolverPlan;
  rootClassifier: {
    resolve(requestInput: RawRequestInput): ResolutionResult<ClassifiedInput>;
  };
}

interface RequestResolutionEnvBuilderDependencies {
  looksLikeIsin(value: string): boolean;
  resolverServices?: ResolverServices;
}


function buildDefaultAttributePlan(
  defaultAttributeRoot: ResolverPlan,
  resolvedRequest: ResolvedRequest,
): ResolverPlan {
  const candidatePlans = (defaultAttributeRoot.nodes || []).filter(
    (plan) => !plan.canHandle || plan.canHandle(resolvedRequest),
  ) as ResolverPlan[];

  if (!candidatePlans.length) {
    throw new Error("No attribute route is available for this request.");
  }

  if (candidatePlans.length > 1) {
    throw buildAmbiguousDefaultAttributeRouteError(
      resolvedRequest,
      candidatePlans,
    );
  }

  return candidatePlans[0] as ResolverPlan;
}

function selectLookupExecution(
  refs: RequestResolutionRuntimeRefs,
  rawRequestInput: RawRequestInput,
): LookupExecutionSelection {
  const classifyOutcome = refs.rootClassifier.resolve(rawRequestInput);

  if (classifyOutcome.status !== "success") {
    throw new Error(classifyOutcome.error || "Request classification failed.");
  }

  const { requestInput, resolvedRequest } = classifyOutcome.value as ClassifiedInput;

  if (resolvedRequest) {
    return {
      attributePlan: buildDefaultAttributePlan(
        refs.defaultAttributeRoot,
        resolvedRequest,
      ),
      buildAttributePlan: null,
      identifierPlan: null,
      requestInput,
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
      refs.identifierPlan,
      requestInput,
      {
        allowNone: true,
      },
    ) as ResolverPlan | null,
    requestInput,
    resolvedRequest: null,
  };
}

export function createRequestResolutionEnv(
  refs: RequestResolutionRuntimeRefs,
  deps: RequestResolutionEnvBuilderDependencies,
): RequestResolutionDependencies {
  const resolverServices = deps.resolverServices || null;

  return {
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
