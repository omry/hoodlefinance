import { createConcreteResolverMaterializationDependencies } from "../core/concrete-resolvers";
import { collectResolverNodesByCode, ResolveFlow } from "../core/resolve-flow";
import { createRequestResolutionEnvHelpers } from "../core/request-resolution-env";
import { looksLikeIsin } from "../core/request";
import { DagPlan } from "../core/spec-data";
import { type LookupEnvelopeResult } from "../core/request-resolution";

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
  const runtimeLookupHelpers = createRequestResolutionEnvHelpers(resolveFlow, {
    looksLikeIsin,
    resolverServices: resolverMaterializationDeps.resolverServices,
  });

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
