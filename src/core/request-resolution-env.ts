import { extractAttributeValue } from "./attribute-extraction";
import { resolveRoutingNode } from "./plan-navigation";
import type { ResolverNode, ResolverPlanNode } from "./planner";
import { type FxPair, FxRequest, RawRequestInput } from "./request";
import { createDefaultResolvePlanBuilder } from "./resolve-plan";
import {
  resolvePlannedQuoteEnvelope,
  type LookupEnvelopeResult,
  type RequestResolutionDependencies,
} from "./request-resolution";
import type { ResolverServices } from "./resolver-services";

export interface RequestResolutionNodeLookup {
  getNodeByCode(code: string): ResolverNode;
  getPlanNodeByCode(code: string): ResolverPlanNode;
}

export interface RequestResolutionEnvBuilderDependencies {
  looksLikeIsin(value: string): boolean;
  resolverServices?: ResolverServices;
}

export interface RequestResolutionEnvHelpers {
  buildResolvePlan: RequestResolutionDependencies["buildResolvePlan"];
  createRequestInput(
    identifier: string,
    attribute?: string,
  ): ReturnType<NonNullable<RequestResolutionDependencies["classifyRawRequest"]>>;
  resolveFxRate(fxPair: FxPair): LookupEnvelopeResult;
  resolutionEnv: RequestResolutionDependencies;
}

function normalizeAttribute(attribute?: string): string {
  return String(attribute == null ? "price" : attribute).trim();
}

export function createRequestResolutionEnvHelpers(
  nodeLookup: RequestResolutionNodeLookup,
  deps: RequestResolutionEnvBuilderDependencies,
): RequestResolutionEnvHelpers {
  const directIdentifierResolver = nodeLookup.getNodeByCode(
    "RESOLVED-IDENTIFIER",
  ) as Parameters<typeof createDefaultResolvePlanBuilder>[0]["directIdentifierResolver"];
  const fxPlan = nodeLookup.getPlanNodeByCode("DEFAULT-ATTRIBUTE:FX");
  const resolverServices = deps.resolverServices || {};
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver,
    getPlanNodeByCode: (code) => nodeLookup.getPlanNodeByCode(code),
  });

  function classifyRawRequest(
    requestInput: RawRequestInput,
  ): ReturnType<NonNullable<RequestResolutionDependencies["classifyRawRequest"]>> {
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

  function createRequestInput(
    identifier: string,
    attribute?: string,
  ): ReturnType<NonNullable<RequestResolutionDependencies["classifyRawRequest"]>> {
    return classifyRawRequest(new RawRequestInput(identifier, normalizeAttribute(attribute)));
  }

  function resolveFxRate(fxPair: FxPair): LookupEnvelopeResult {
    const fxRequest = new FxRequest({
      attribute: "price",
      fxPair,
      identifier: fxPair.yahooChartSymbol,
    });
    const env = resolvePlannedQuoteEnvelope(fxPlan, fxRequest, []);

    if (env.status === "success") {
      const price = Number(
        extractAttributeValue(env.value as Record<string, unknown>, "price"),
      );
      if (Number.isFinite(price)) {
        return { ...env, value: price };
      }
    }

    return env;
  }

  const resolutionEnv: RequestResolutionDependencies = {
    buildResolvePlan,
    classifyRawRequest,
    getCachedString: (cacheKey) =>
      typeof resolverServices.getCachedString === "function"
        ? resolverServices.getCachedString(cacheKey)
        : "",
    httpFetch: (url) => {
      if (typeof resolverServices.httpFetch !== "function") {
        throw new Error(
          `ResolveFlow requires resolverServices.httpFetch to fetch "${url}".`,
        );
      }

      return resolverServices.httpFetch(url);
    },
    looksLikeIsin: deps.looksLikeIsin,
    putCachedString: (cacheKey, value, ttlSeconds) =>
      typeof resolverServices.putCachedString === "function"
        ? resolverServices.putCachedString(
            cacheKey,
            value,
            Number.isFinite(ttlSeconds) ? Number(ttlSeconds) : 0,
          )
        : String(value || ""),
    resolveFxRate,
  };

  return {
    buildResolvePlan,
    createRequestInput,
    resolveFxRate,
    resolutionEnv,
  };
}
