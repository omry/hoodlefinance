import { createConcreteResolverMaterializationDependencies } from "../core/concrete-resolvers";
import { collectResolverNodesByCode, ResolveFlow } from "../core/resolve-flow";
import { resolveRoutingNode } from "../core/plan-navigation";
import { createDefaultResolvePlanBuilder } from "../core/resolve-plan";
import {
  type FxPair,
  FxRequest,
  looksLikeIsin,
  RawRequestInput,
} from "../core/request";
import { DagPlan } from "../core/spec-data";
import {
  resolvePlannedQuoteEnvelope,
  type LookupEnvelopeResult,
  type RequestResolutionDependencies,
} from "../core/request-resolution";
import { extractAttributeValue } from "../core/attribute-extraction";

interface HoodlefinanceRuntimeDependencies {
  httpFetch(url: string): string;
  getCachedJson(key: string): unknown;
  getCachedString(key: string): string;
  getStoredTextResource?(key: string): {
    fetchedAtMs: number;
    text: string;
  } | null;
  putCachedJson(key: string, value: unknown, ttlSeconds: number): unknown;
  putCachedString(key: string, value: string, ttlSeconds: number): string;
  putStoredTextResource?(
    key: string,
    text: string,
    fetchedAtMs: number,
  ): {
    fetchedAtMs: number;
    text: string;
  } | null;
}

interface HoodlefinanceRuntime {
  lookup(identifier: string, attribute?: string): LookupEnvelopeResult;
  lookupEnvelope(identifier: string, attribute?: string): LookupEnvelopeResult;
  lookupViaGraph(identifier: string, attribute?: string): LookupEnvelopeResult;
  resolveAttribute(identifier: string, attribute?: string): unknown;
}

function createRuntimeLookupHelpers(resolveFlow: ResolveFlow) {
  const directIdentifierResolver = resolveFlow.getNodeByCode(
    "RESOLVED-IDENTIFIER",
  ) as Parameters<typeof createDefaultResolvePlanBuilder>[0]["directIdentifierResolver"];
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver,
    getPlanNodeByCode: (code) => resolveFlow.getPlanNodeByCode(code),
  });
  const fxPlan = resolveFlow.getPlanNodeByCode("DEFAULT-ATTRIBUTE:FX");

  function createRequestInput(
    identifier: string,
    attribute?: string,
  ): ReturnType<NonNullable<RequestResolutionDependencies["classifyRawRequest"]>> {
    const rawRequestInput = new RawRequestInput(
      identifier,
      String(attribute == null ? "price" : attribute).trim(),
    );
    const resolvedNode = resolveRoutingNode(
      resolveFlow.getPlanNodeByCode("ROOT"),
      rawRequestInput,
    );

    if (!resolvedNode || typeof resolvedNode.resolve !== "function") {
      throw new Error("Request classification failed.");
    }

    const outcome = resolvedNode.resolve(rawRequestInput);

    if (outcome.status !== "success") {
      throw new Error(outcome.error || "Request classification failed.");
    }

    return outcome.value as ReturnType<
      NonNullable<RequestResolutionDependencies["classifyRawRequest"]>
    >;
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

  return {
    buildResolvePlan,
    createRequestInput,
    resolveFxRate,
  };
}

export function createHoodlefinanceRuntime(
  deps: HoodlefinanceRuntimeDependencies,
): HoodlefinanceRuntime {
  const resolverMaterializationDeps =
    createConcreteResolverMaterializationDependencies({
      httpFetch: deps.httpFetch,
      getCachedJson: deps.getCachedJson,
      getCachedString: deps.getCachedString,
      putCachedJson: deps.putCachedJson,
      putCachedString: deps.putCachedString,
      ...(typeof deps.getStoredTextResource === "function"
        ? {
            getStoredTextResource: deps.getStoredTextResource,
          }
        : {}),
      ...(typeof deps.putStoredTextResource === "function"
        ? {
            putStoredTextResource: deps.putStoredTextResource,
          }
        : {}),
    });

  const resolveFlow = new ResolveFlow(DagPlan, {
    ...resolverMaterializationDeps,
    looksLikeIsin(value) {
      return looksLikeIsin(value);
    },
  });
  const runtimeLookupHelpers = createRuntimeLookupHelpers(resolveFlow);

  const runtime = {
    lookup: resolveFlow.lookup,
    lookupEnvelope: resolveFlow.lookupEnvelope,
    lookupViaGraph: resolveFlow.lookup,
    resolveAttribute(identifier: string, attribute?: string): unknown {
      return resolveFlow.resolveAttribute(identifier, attribute);
    },
    // Internal extras exposed for JS consumers (not in HoodlefinanceRuntime type)
    buildResolvePlan: runtimeLookupHelpers.buildResolvePlan,
    createRequestInput: runtimeLookupHelpers.createRequestInput,
    httpFetch: deps.httpFetch,
    getPlanNodeByCode(code: string) {
      return resolveFlow.getPlanNodeByCode(code);
    },
    resolveFxRate: runtimeLookupHelpers.resolveFxRate,
    resolversByCode: collectResolverNodesByCode(resolveFlow),
  };

  return runtime as HoodlefinanceRuntime & typeof runtime;
}
