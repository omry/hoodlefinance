import {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
} from "../core/concrete-resolvers";
import { createDefaultResolvePlanBuilder } from "../core/resolve-plan";
import { createRequestInput } from "../core/request-building";
import { looksLikeIsin, type FxPair, type RequestInput } from "../core/request";
import {
  createDefaultPlanMaterializationDependencies,
  materializePlanFromSpec,
} from "../core/plan-materialization";
import { PLAN_SPECS_BY_CODE } from "../core/spec-data";
import {
  resolveRequestEnvelope,
  resolveRequestValue,
  type LookupEnvelopeResult,
} from "../core/request-resolution";
import type { ResolvePlan, ResolverPlanNode } from "../core/planner";

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
  directIdentifierResolver: DirectIdentifierResolver;
  fetchText(url: string): string;
  googleFxResolver: GoogleFxResolver;
  localFxResolver: LocalFxResolver;
  lookup(identifier: unknown, attribute?: unknown): LookupEnvelopeResult;
  lookupEnvelope(identifier: unknown, attribute?: unknown): LookupEnvelopeResult;
  materializePlanFromSpec(code: string): ResolverPlanNode;
  pseEdgeResolver: PseEdgeResolver;
  pseFramesResolver: PseFramesResolver;
  pseIsinMapResolver: PseIsinMapResolver;
  tradingviewFundResolver: TradingviewFundResolver;
  yahooIsinSearchResolver: YahooIsinSearchResolver;
  yahooQuoteResolver: YahooQuoteResolver;
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
  const directIdentifierResolver = new DirectIdentifierResolver();
  const googleFxResolver = new GoogleFxResolver({
    fetchText: deps.fetchText,
    getCachedJson: deps.getCachedJson,
    putCachedJson: deps.putCachedJson,
  });
  const localFxResolver = new LocalFxResolver();
  const pseFramesResolver = new PseFramesResolver({
    fetchAllInChunks,
    getCachedJson: deps.getCachedJson,
    putCachedJson: deps.putCachedJson,
  });
  const pseEdgeResolver = new PseEdgeResolver({
    fetchAllInChunks,
    getCachedJson: deps.getCachedJson,
    putCachedJson: deps.putCachedJson,
  });
  const pseIsinMapResolver = new PseIsinMapResolver((isin) =>
    deps.resolvePseTickerFromIsinMap(isin),
  );
  const yahooQuoteResolver = new YahooQuoteResolver({
    fetchAllInChunks,
    getCachedJson: deps.getCachedJson,
    putCachedJson: deps.putCachedJson,
  });
  const tradingviewFundResolver = new TradingviewFundResolver({
    fetchAllInChunks,
    getCachedJson: deps.getCachedJson,
    putCachedJson: deps.putCachedJson,
  });
  const yahooIsinSearchResolver = new YahooIsinSearchResolver({
    fetchAllInChunks,
    getCachedString: deps.getCachedString,
    putCachedString: deps.putCachedString,
  });
  const resolversByCode = {
    "DIRECT-IDENTIFIER": directIdentifierResolver,
    GOOGLE: googleFxResolver,
    LOCAL: localFxResolver,
    "PSE-EDGE": pseEdgeResolver,
    "PSE-FRAMES": pseFramesResolver,
    "PSE-MAP": pseIsinMapResolver,
    "TRADINGVIEW-FUND": tradingviewFundResolver,
    YAHOO: yahooQuoteResolver,
    "YAHOO-ISIN": yahooIsinSearchResolver,
  };
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
    directIdentifierResolver,
    materializePlanFromSpec(code) {
      return materializePlanFromSpec(
        code,
        null,
        planMaterializationDeps,
      ) as ResolverPlanNode;
    },
  });

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
    directIdentifierResolver,
    fetchText: deps.fetchText,
    googleFxResolver,
    localFxResolver,
    lookup(identifier, attribute) {
      return resolveRequestValue(
        {
          buildResolvePlan,
          fetchText: deps.fetchText,
          getCachedString: deps.getCachedString,
          looksLikeIsin,
          putCachedString: deps.putCachedString,
        },
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
      return resolveRequestEnvelope(
        {
          buildResolvePlan,
          fetchText: deps.fetchText,
          getCachedString: deps.getCachedString,
          looksLikeIsin,
          putCachedString: deps.putCachedString,
        },
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
    pseEdgeResolver,
    pseFramesResolver,
    pseIsinMapResolver,
    tradingviewFundResolver,
    yahooIsinSearchResolver,
    yahooQuoteResolver,
  };
}
