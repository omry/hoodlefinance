import {
  createConcreteResolverMaterializationDependencies,
} from "../core/concrete-resolvers";
import { compileDagPlanForLegacyExecution } from "../core/dag-plan-legacy-execution";
import { createDefaultResolvePlanBuilder } from "../core/resolve-plan";
import { createRequestInput } from "../core/request-building";
import { extractAttributeValue } from "../core/attribute-extraction";
import {
  looksLikeIsin,
  FxRequest,
  type FxPair,
  type RequestInput,
} from "../core/request";
import { buildFxPairFromCodes } from "../core/fx-normalization";
import {
  DagPlan,
} from "../core/spec-data";
import {
  resolvePlannedQuoteEnvelope,
  resolveRequestEnvelope,
  resolveRequestValue,
  type LookupEnvelopeResult,
  type RequestResolutionDependencies,
} from "../core/request-resolution";
import type { ResolverPlanNode } from "../core/planner";

interface HoodlefinanceRuntimeDependencies {
  httpFetch(url: string): string;
  getCachedJson(key: string): unknown;
  getCachedString(key: string): string;
  parseFxTicker?(ticker: string): FxPair | null;
  putCachedJson(key: string, value: unknown, ttlSeconds: number): unknown;
  putCachedString(key: string, value: string, ttlSeconds: number): string;
  resolvePreferredYahooSymbol?(symbol: string): string;
  resolvePseTickerFromIsinMap(isin: string): string;
}

interface HoodlefinanceRuntime {
  lookup(identifier: string, attribute?: string): LookupEnvelopeResult;
  lookupEnvelope(identifier: string, attribute?: string): LookupEnvelopeResult;
  lookupViaGraph(identifier: string, attribute?: string): LookupEnvelopeResult;
}

function normalizePreferredTickerKey(ticker: string): string {
  const match = String(ticker || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+)-([A-Z])$/);

  return match ? `${match[1]}-${match[2]}` : "";
}

function buildPreferredFallbackSymbol(ticker: string): string {
  const normalized = normalizePreferredTickerKey(ticker);

  return normalized ? normalized.replace(/-([A-Z])$/, "-P$1") : "";
}

export function parsePreferredReitTickerSet(text: string): Set<string> {
  let payload: Record<string, unknown> | null = null;

  try {
    payload = JSON.parse(String(text || "")) as Record<string, unknown>;
  } catch {
    return new Set();
  }

  const entries = Array.isArray(payload?.preferredTickers)
    ? payload.preferredTickers
    : [];
  const normalizedSet = new Set<string>();

  for (const entry of entries) {
    const normalized = String(entry || "")
      .trim()
      .toUpperCase();
    const parts = normalized.split(/\s+/);

    if (
      parts.length === 2 &&
      /^[A-Z0-9]+$/.test(parts[0] || "") &&
      /^[A-Z]$/.test(parts[1] || "")
    ) {
      normalizedSet.add(`${parts[0]}-${parts[1]}`);
    }
  }

  return normalizedSet;
}

export function createPreferredYahooSymbolResolver(
  preferredTickerSet: ReadonlySet<string>,
): (ticker: string) => string {
  return function resolvePreferredYahooSymbol(ticker: string): string {
    const normalizedKey = normalizePreferredTickerKey(ticker);

    if (!normalizedKey || !preferredTickerSet.has(normalizedKey)) {
      return "";
    }

    return buildPreferredFallbackSymbol(ticker);
  };
}

export function parsePropertiesMap(text: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim().toUpperCase();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key) {
      output[key] = value;
    }
  }

  return output;
}

export function createHoodlefinanceRuntime(
  deps: HoodlefinanceRuntimeDependencies,
): HoodlefinanceRuntime {
  type DirectIdentifierResolverLike = Parameters<
    typeof createDefaultResolvePlanBuilder
  >[0]["directIdentifierResolver"];
  const resolvePreferredYahooSymbol = (symbol: string): string =>
    typeof deps.resolvePreferredYahooSymbol === "function"
      ? deps.resolvePreferredYahooSymbol(symbol)
      : "";

  const resolverMaterializationDeps =
    createConcreteResolverMaterializationDependencies({
      httpFetch: deps.httpFetch,
      getCachedJson: deps.getCachedJson,
      getCachedString: deps.getCachedString,
      putCachedJson: deps.putCachedJson,
      putCachedString: deps.putCachedString,
      resolvePseTickerFromIsinMap: (isin) => deps.resolvePseTickerFromIsinMap(isin),
    });

  function createResolutionPath(
    dagPlan: typeof DagPlan,
  ) {
    const compiledDagPlan = compileDagPlanForLegacyExecution(dagPlan, {
      ...resolverMaterializationDeps,
      looksLikeIsin(value) {
        return looksLikeIsin(value);
      },
      resolvePreferredYahooSymbol,
    });
    const directIdentifierResolver = compiledDagPlan.getNodeByCode(
      "RESOLVED-IDENTIFIER",
    )!;
    const getPathPlanNodeByCode = (code: string): ResolverPlanNode =>
      compiledDagPlan.getPlanNodeByCode(code);
    const buildResolvePlan = createDefaultResolvePlanBuilder({
      directIdentifierResolver:
        directIdentifierResolver as DirectIdentifierResolverLike,
      getPlanNodeByCode: getPathPlanNodeByCode,
    });
    const fxPlan = getPathPlanNodeByCode("DEFAULT-ATTRIBUTE:FX");

    let resolveFxRate: (fxPair: FxPair) => LookupEnvelopeResult;
    const resolutionEnv: RequestResolutionDependencies = {
      buildResolvePlan,
      httpFetch: deps.httpFetch,
      getCachedString: deps.getCachedString,
      looksLikeIsin,
      putCachedString: deps.putCachedString,
      resolveFxRate: (fxPair) => resolveFxRate(fxPair),
    };

    resolveFxRate = (fxPair: FxPair): LookupEnvelopeResult => {
      const fxRequest = new FxRequest({
        attribute: "price",
        fxPair,
        identifier: fxPair.yahooSymbol,
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
    };

    return {
      buildResolvePlan,
      getPlanNodeByCode: getPathPlanNodeByCode,
      resolutionEnv,
      resolversByCode: compiledDagPlan.resolverNodesByCode,
      resolveFxRate,
    };
  }

  const dagResolutionPath = createResolutionPath(DagPlan);
  const {
    buildResolvePlan,
    getPlanNodeByCode,
    resolutionEnv,
    resolversByCode,
    resolveFxRate,
  } = dagResolutionPath;

  // Helper to normalize request input parameters
  const normalizeRequestInput = (
    identifier: string,
    attribute: string | undefined,
  ) =>
    createRequestInput(
      identifier,
      String(attribute == null ? "price" : attribute).trim(),
      ...(typeof deps.parseFxTicker === "function"
        ? [
          {
            parseFxTicker: deps.parseFxTicker,
          },
        ]
        : []),
    );

  const runtime = {
    lookup(identifier: string, attribute?: string): LookupEnvelopeResult {
      return resolveRequestValue(resolutionEnv, normalizeRequestInput(identifier, attribute));
    },
    lookupEnvelope(identifier: string, attribute?: string): LookupEnvelopeResult {
      return resolveRequestEnvelope(resolutionEnv, normalizeRequestInput(identifier, attribute));
    },
    // Internal extras exposed for JS consumers (not in HoodlefinanceRuntime type)
    buildResolvePlan,
    createRequestInput: normalizeRequestInput,
    httpFetch: deps.httpFetch,
    getPlanNodeByCode(code: string) {
      return getPlanNodeByCode(code);
    },
    resolveFxRate,
    resolversByCode,
  };

  return runtime as HoodlefinanceRuntime & typeof runtime;
}
