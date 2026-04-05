import {
  createConcreteResolverMaterializationDependencies,
} from "../core/concrete-resolvers";
import {
  materializeResolversByCode,
  getMaterializedResolverByCode,
} from "../core/resolver-materialization";
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
  createDefaultPlanMaterializationDependencies,
  materializePlanFromSpec,
} from "../core/plan-materialization";
import { PLAN_SPECS_BY_CODE, RESOLVER_SPECS_BY_CODE } from "../core/spec-data";
import {
  resolvePlannedQuoteEnvelope,
  resolveRequestEnvelope,
  resolveRequestValue,
  type LookupEnvelopeResult,
} from "../core/request-resolution";
import type { ResolvePlan, ResolverNode, ResolverPlanNode } from "../core/planner";

interface FetchTextResponseLike {
  getContentText(): string;
  getResponseCode(): number;
}

interface FetchTextRequestLike {
  url: string;
}

interface FetchTextBatchResult<TRequest extends FetchTextRequestLike> {
  error?: unknown;
  request: TRequest;
  response?: FetchTextResponseLike;
}

type FetchAllInChunks = <TRequest extends FetchTextRequestLike>(
  source: string,
  requests: TRequest[],
) => Array<FetchTextBatchResult<TRequest>>;

interface HoodlefinanceRuntimeDependencies {
  fetchAllInChunks?: FetchAllInChunks;
  fetchText(url: string): string;
  getCachedJson(key: string): unknown;
  getCachedString(key: string): string;
  parseFxTicker?(ticker: string): FxPair | null;
  putCachedJson(key: string, value: unknown, ttlSeconds: number): unknown;
  putCachedString(key: string, value: string, ttlSeconds: number): string;
  resolvePreferredYahooSymbol?(symbol: string): string;
  resolvePseTickerFromIsinMap(isin: string): string;
}

interface HoodlefinanceRuntime {
  buildResolvePlan(requestInput: RequestInput): Readonly<ResolvePlan>;
  createRequestInput(identifier: unknown, attribute?: unknown): RequestInput;
  fetchText(url: string): string;
  lookup(identifier: unknown, attribute?: unknown): LookupEnvelopeResult;
  lookupEnvelope(identifier: unknown, attribute?: unknown): LookupEnvelopeResult;
  materializePlanFromSpec(code: string): ResolverPlanNode;
  resolversByCode: Record<string, ResolverNode>;
  resolveFxRate(fxPair: FxPair): LookupEnvelopeResult;
}

function createInlineFetchResponse(
  body: string,
  responseCode = 200,
): FetchTextResponseLike {
  return {
    getContentText() {
      return body;
    },
    getResponseCode() {
      return responseCode;
    },
  };
}

function createSequentialFetchAllInChunks(
  fetchText: (url: string) => string,
): FetchAllInChunks {
  return function fetchAllInChunks<TRequest extends FetchTextRequestLike>(
    _source: string,
    requests: TRequest[],
  ): Array<FetchTextBatchResult<TRequest>> {
    return requests.map((request) => {
      try {
        return {
          request,
          response: createInlineFetchResponse(fetchText(request.url)),
        };
      } catch (error) {
        return {
          error,
          request,
        };
      }
    });
  };
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
  const fetchAllInChunks =
    deps.fetchAllInChunks || createSequentialFetchAllInChunks(deps.fetchText);
  const { byCode: resolversByCode } = materializeResolversByCode(
    RESOLVER_SPECS_BY_CODE,
    createConcreteResolverMaterializationDependencies({
      googleFx: {
        fetchText: deps.fetchText,
        getCachedJson: deps.getCachedJson,
        putCachedJson: deps.putCachedJson,
      },
      pseQuotes: {
        fetchAllInChunks,
        getCachedJson: deps.getCachedJson,
        putCachedJson: deps.putCachedJson,
      },
      resolvePseTickerFromIsinMap: (isin) => deps.resolvePseTickerFromIsinMap(isin),
      yahooIsinSearch: {
        fetchAllInChunks,
        getCachedString: deps.getCachedString,
        putCachedString: deps.putCachedString,
      },
      yahooQuote: {
        fetchAllInChunks,
        getCachedJson: deps.getCachedJson,
        putCachedJson: deps.putCachedJson,
      },
      tradingviewFund: {
        fetchAllInChunks,
        getCachedJson: deps.getCachedJson,
        putCachedJson: deps.putCachedJson,
      },
    }),
  );
  const directIdentifierResolver = getMaterializedResolverByCode(
    { byCode: resolversByCode, byName: {} },
    "RESOLVED-IDENTIFIER",
  )!;
  const planMaterializationDeps = createDefaultPlanMaterializationDependencies({
    looksLikeIsin(value) {
      return looksLikeIsin(value);
    },
    planSpecsByCode: PLAN_SPECS_BY_CODE,
    resolvePreferredYahooSymbol(symbol) {
      return typeof deps.resolvePreferredYahooSymbol === "function"
        ? deps.resolvePreferredYahooSymbol(symbol)
        : "";
    },
    resolversByCode,
  });
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: directIdentifierResolver as Parameters<typeof createDefaultResolvePlanBuilder>[0]["directIdentifierResolver"],
    materializePlanFromSpec(code) {
      return materializePlanFromSpec(
        code,
        null,
        planMaterializationDeps,
      ) as ResolverPlanNode;
    },
  });

  function resolveFxRate(fxPair: FxPair): LookupEnvelopeResult {
    const fxRequest = new FxRequest({
      attribute: "price",
      fxPair,
      identifier: fxPair.yahooSymbol,
    });

    const fxPlan = materializePlanFromSpec(
      "DEFAULT-ATTRIBUTE:FX",
      null,
      planMaterializationDeps,
    ) as ResolverPlanNode;

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
    createRequestInput(identifier, attribute) {
      return createRequestInput(
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
    },
    resolveFxRate,
    fetchText: deps.fetchText,
    lookup(identifier, attribute) {
      const env = {
        buildResolvePlan,
        fetchText: deps.fetchText,
        getCachedString: deps.getCachedString,
        looksLikeIsin,
        putCachedString: deps.putCachedString,
        resolveFxRate,
      };

      return resolveRequestValue(
        env,
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
        ),
      );
    },
    lookupEnvelope(identifier, attribute) {
      const env = {
        buildResolvePlan,
        fetchText: deps.fetchText,
        getCachedString: deps.getCachedString,
        looksLikeIsin,
        putCachedString: deps.putCachedString,
        resolveFxRate,
      };

      return resolveRequestEnvelope(
        env,
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
        ),
      );
    },
    materializePlanFromSpec(code) {
      return materializePlanFromSpec(
        code,
        null,
        planMaterializationDeps,
      ) as ResolverPlanNode;
    },
    resolversByCode,
  };
}
