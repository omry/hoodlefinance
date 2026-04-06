import type { ResolverSpec } from "./plan-specs";
import { EquityRequest, FxRequest, RequestInput, type ResolvedRequest } from "./request";
import { buildIsinIdentifierRouteState, buildPseQuoteRouteState } from "./route-state";
import {
  IdentifierResolver,
  RouteExecutionResolver,
} from "./resolver-classes";
import {
  buildTypedRequestFromParsedInput,
  buildTypedRequestFromResolvedTicker,
  extractIsinFromRequestInput,
} from "./request-building";
import {
  buildSameCurrencyQuote,
  decorateFxQuote,
  extractRawQuote,
  isSameCurrencyFxPair,
} from "./fx-quotes";
import {
  buildGoogleFinanceQuoteUrl,
  extractGoogleFinanceFxPairQuote,
} from "./google-fx";
import {
  buildPseListingCacheKey,
  buildPseSearchUrl,
  buildPseSecurityFrameUrl,
  buildPseStockDataUrl,
  buildPseUnavailableError,
  extractPseFrameQuoteFromResponse,
  extractPseQuoteFromResponse,
  isPseListingNotFoundError,
  isPseUnavailableError,
  tryResolvePseListingFromHtml,
  type PseListing,
  type PseQuoteResponseLike,
} from "./pse-quotes";
import {
  buildYahooIsinSearchUrl,
  extractYahooSymbolFromSearchResponse,
  type YahooSearchResponseLike,
} from "./yahoo-isin-search";
import {
  buildYahooChartUrl,
  extractYahooQuoteMetaFromResponse,
  type YahooQuoteResponseLike,
} from "./yahoo-quote";
import {
  buildIsraeliFundTradingviewFallbackInfo,
  extractTradingviewFundQuoteFromResponse,
  type TradingviewQuoteResponseLike,
} from "./tradingview-fund";
import {
  createResolutionFailure,
  createResolutionSuccess,
  createRouteResult,
  type RouteResult,
} from "./route-results";
import type { RouteJob, RuntimePlan } from "./planner";
import type { ResolverClassLike } from "./resolver-materialization";
import { buildFxQuoteRouteState } from "./route-state";

export class DirectIdentifierResolver extends IdentifierResolver {
  constructor() {
    super("RESOLVED-IDENTIFIER");
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return input instanceof RequestInput && !extractIsinFromRequestInput(input);
  }

  resolve(input: RequestInput | ResolvedRequest) {
    const startedAtMs = Date.now();

    try {
      if (!this.canHandle(input)) {
        return createResolutionFailure(
          "Identifier resolution requires a discovery resolver.",
          Date.now() - startedAtMs,
          (error) => String(error instanceof Error ? error.message : error ?? ""),
        );
      }

      const requestInput = input as RequestInput;
      const resolvedRequest = buildTypedRequestFromParsedInput(
        requestInput,
        requestInput,
        0,
      );
      resolvedRequest.identifierResolutionMs = Math.max(
        0,
        Date.now() - startedAtMs,
      );

      return createResolutionSuccess(
        resolvedRequest,
        resolvedRequest.identifierResolutionMs,
      );
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        (caughtError) =>
          String(caughtError instanceof Error ? caughtError.message : caughtError ?? ""),
      );
    }
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
  ): DirectIdentifierResolver {
    return new this();
  }
}

export type ResolvePseTickerFromIsinMap = (isin: string) => string;
export interface YahooIsinSearchRequest {
  cacheKey: string;
  index: number;
  isin: string;
  url: string;
}

export interface YahooIsinSearchBatchResponse {
  error?: unknown;
  request: YahooIsinSearchRequest;
  response?: YahooSearchResponseLike;
}

export interface YahooIsinSearchResolverDependencies {
  fetchAllInChunks(
    source: string,
    requests: YahooIsinSearchRequest[],
  ): YahooIsinSearchBatchResponse[];
  getCachedString(cacheKey: string): string;
  putCachedString(cacheKey: string, value: string, ttlSeconds: number): string;
}

export interface GoogleFxResolverDependencies {
  fetchText(url: string): string;
  getCachedJson(cacheKey: string): unknown;
  putCachedJson(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
}

export interface PseQuoteResolverDependencies {
  fetchAllInChunks(
    source: string,
    requests: Array<{
      cacheKey: string;
      index: number;
      listing?: PseListing | null;
      symbol: string;
      url: string;
    }>,
  ): Array<{
    error?: unknown;
    request: {
      cacheKey: string;
      index: number;
      listing?: PseListing | null;
      symbol: string;
      url: string;
    };
    response?: PseQuoteResponseLike;
  }>;
  getCachedJson(cacheKey: string): unknown;
  putCachedJson(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
}

export interface YahooQuoteResolverDependencies {
  fetchAllInChunks(
    source: string,
    requests: Array<{
      cacheKey: string;
      index: number;
      url: string;
      yahooSymbol: string;
    }>,
  ): Array<{
    error?: unknown;
    request: {
      cacheKey: string;
      index: number;
      url: string;
      yahooSymbol: string;
    };
    response?: YahooQuoteResponseLike;
  }>;
  getCachedJson(cacheKey: string): unknown;
  putCachedJson(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
}

export interface TradingviewFundResolverDependencies {
  fetchAllInChunks(
    source: string,
    requests: Array<{
      cacheKey: string;
      expectedSymbol: string;
      index: number;
      primaryCacheKey: string;
      url: string;
      yahooSymbol: string;
    }>,
  ): Array<{
    error?: unknown;
    request: {
      cacheKey: string;
      expectedSymbol: string;
      index: number;
      primaryCacheKey: string;
      url: string;
      yahooSymbol: string;
    };
    response?: TradingviewQuoteResponseLike;
  }>;
  getCachedJson(cacheKey: string): unknown;
  putCachedJson(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
}

export class PseIsinMapResolver extends IdentifierResolver {
  readonly traceLabel: string;
  readonly resolvePseTickerFromIsinMap: ResolvePseTickerFromIsinMap;

  constructor(resolvePseTickerFromIsinMap: ResolvePseTickerFromIsinMap) {
    super("PSE-MAP", "PSE", {
      routingDescription: "PSE ISIN map lookup",
    });
    this.traceLabel = "pse-isin-map";
    this.resolvePseTickerFromIsinMap = resolvePseTickerFromIsinMap;
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    const isin = extractIsinFromRequestInput(
      input as Pick<RequestInput, "ticker">,
    );

    return input instanceof RequestInput && isin.startsWith("PH");
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof RequestInput)) {
      return {};
    }

    return buildIsinIdentifierRouteState(request, extractIsinFromRequestInput);
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.traceLabel,
      routeState: this.buildRouteState(request),
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results = [];

    for (const job of jobs) {
      try {
        const isin = String(job.routeState.isin || "").trim();
        const pseTicker = this.resolvePseTickerFromIsinMap(isin);

        if (!pseTicker) {
          results.push(createRouteResult("lookup_failure"));
          continue;
        }

        results.push(
          createRouteResult("success", {
            value: buildTypedRequestFromResolvedTicker(
              job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
              pseTicker,
              0,
            ),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    resolvePseTickerFromIsinMap?: ResolvePseTickerFromIsinMap,
  ): PseIsinMapResolver {
    if (typeof resolvePseTickerFromIsinMap !== "function") {
      throw new Error(
        "PseIsinMapResolver requires resolvePseTickerFromIsinMap.",
      );
    }

    return new this(resolvePseTickerFromIsinMap);
  }
}

export class YahooIsinSearchResolver extends IdentifierResolver {
  readonly traceLabel: string;
  readonly fetchAllInChunks: YahooIsinSearchResolverDependencies["fetchAllInChunks"];
  readonly getCachedString: YahooIsinSearchResolverDependencies["getCachedString"];
  readonly putCachedString: YahooIsinSearchResolverDependencies["putCachedString"];

  constructor(deps: YahooIsinSearchResolverDependencies) {
    super("YAHOO-ISIN", "YAHOO", {
      routingDescription: "Yahoo search by ISIN",
    });
    this.traceLabel = "YAHOO-ISIN";
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedString = deps.getCachedString;
    this.putCachedString = deps.putCachedString;
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return (
      input instanceof RequestInput &&
      !!extractIsinFromRequestInput(input)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof RequestInput)) {
      return {};
    }

    return buildIsinIdentifierRouteState(request, extractIsinFromRequestInput);
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.traceLabel,
      routeState: this.buildRouteState(request),
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const requests: YahooIsinSearchRequest[] = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const cacheKey = `hoodlefinance:isin:${job.routeState.isin}`;
      const cached = this.getCachedString(cacheKey);

      if (cached) {
        results[i] = createRouteResult("success", {
          value: buildTypedRequestFromResolvedTicker(
            job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
            cached,
            0,
          ),
        });
        continue;
      }

      requests.push({
        cacheKey,
        index: i,
        isin: String(job.routeState.isin || "").trim(),
        url: buildYahooIsinSearchUrl(String(job.routeState.isin || "").trim()),
      });
    }

    const responses = this.fetchAllInChunks("yahoo-isin-search", requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult("lookup_failure", {
          error: responseItem.error,
        });
        continue;
      }

      try {
        const job = jobs[responseItem.request.index];
        if (!job) {
          results[responseItem.request.index] = createRouteResult(
            "terminal_error",
            {
              error: "Route job is missing for Yahoo ISIN search response.",
            },
          );
          continue;
        }

        const resolvedTicker = extractYahooSymbolFromSearchResponse(
          responseItem.response as YahooSearchResponseLike,
          responseItem.request.isin,
        );
        this.putCachedString(responseItem.request.cacheKey, resolvedTicker, 21600);
        results[responseItem.request.index] = createRouteResult("success", {
          value: buildTypedRequestFromResolvedTicker(
            job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
            resolvedTicker,
            0,
          ),
        });
      } catch (error) {
        results[responseItem.request.index] = createRouteResult("lookup_failure", {
          error,
        });
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: YahooIsinSearchResolverDependencies,
  ): YahooIsinSearchResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedString !== "function" ||
      typeof deps.putCachedString !== "function"
    ) {
      throw new Error(
        "YahooIsinSearchResolver requires fetchAllInChunks, getCachedString, and putCachedString.",
      );
    }

    return new this(deps);
  }
}

export class LocalFxResolver extends RouteExecutionResolver {
  constructor() {
    super("FX-IDENTITY", "FX-IDENTITY", {
      routingDescription: "Same-currency FX identity rate",
    });
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      !!request &&
      "requestType" in request &&
      request.requestType === "fx" &&
      !!request.fxPair &&
      isSameCurrencyFxPair(request.fxPair)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!this.canHandle(request)) {
      return {};
    }

    const fxRequest = request as Extract<ResolvedRequest, { requestType: "fx" }>;

    return {
      fxPair: fxRequest.fxPair,
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results = [];

    for (const job of jobs) {
      try {
        results.push(
          createRouteResult("success", {
            quote: buildSameCurrencyQuote(job.routeState.fxPair as import("./request").FxPair),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
  ): LocalFxResolver {
    return new this();
  }
}

export class GoogleFxResolver extends RouteExecutionResolver {
  readonly fetchText: GoogleFxResolverDependencies["fetchText"];
  readonly getCachedJson: GoogleFxResolverDependencies["getCachedJson"];
  readonly putCachedJson: GoogleFxResolverDependencies["putCachedJson"];

  constructor(deps: GoogleFxResolverDependencies) {
    super("GOOGLE-FX", "GOOGLE-FX", {

      representativeTicker: "EURUSD",
      routingDescription: "Google Finance FX quote lookup",
    });
    this.fetchText = deps.fetchText;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      request instanceof FxRequest &&
      !!request.fxPair &&
      !isSameCurrencyFxPair(request.fxPair)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof FxRequest)) {
      return {};
    }

    return buildFxQuoteRouteState(request);
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      try {
        const fxPair = job.routeState.fxPair as FxRequest["fxPair"];
        const pairSlug = String(fxPair.googlePairSlug || "").trim();
        const cacheKey = `hoodlefinance:google-finance:${pairSlug}`;
        const cached = this.getCachedJson(cacheKey);

        if (cached) {
          results[i] = createRouteResult("success", {
            quote: decorateFxQuote(
              cached as Record<string, unknown>,
              fxPair,
            ),
          });
          continue;
        }

        const quote = extractGoogleFinanceFxPairQuote(
          this.fetchText(buildGoogleFinanceQuoteUrl(pairSlug)),
          fxPair,
        );
        this.putCachedJson(cacheKey, quote, 60);
        results[i] = createRouteResult("success", {
          quote: decorateFxQuote(quote, fxPair),
        });
      } catch (error) {
        results[i] = createRouteResult("terminal_error", { error });
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: GoogleFxResolverDependencies,
  ): GoogleFxResolver {
    if (
      !deps ||
      typeof deps.fetchText !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "GoogleFxResolver requires fetchText, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

const PSE_QUOTE_CACHE_TTL_SECONDS = 300;
const PSE_LISTING_CACHE_TTL_SECONDS = 6 * 60 * 60;

function normalizePseListing(value: unknown): PseListing | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const listing = value as PseListing;
  const companyId = String(listing.companyId || "").trim();
  const securityId = String(listing.securityId || "").trim();
  const symbol = String(listing.symbol || "").trim().toUpperCase();
  const name = String(listing.name || "").trim();

  if (!companyId || !securityId || !symbol) {
    return null;
  }

  return {
    companyId,
    name,
    securityId,
    symbol,
  };
}

function buildPseQuoteCacheKey(symbol: string): string {
  return `hoodlefinance:pse:${String(symbol || "").trim().toUpperCase()}`;
}

export class PseFramesResolver extends RouteExecutionResolver {
  readonly fetchAllInChunks: PseQuoteResolverDependencies["fetchAllInChunks"];
  readonly getCachedJson: PseQuoteResolverDependencies["getCachedJson"];
  readonly putCachedJson: PseQuoteResolverDependencies["putCachedJson"];

  constructor(deps: PseQuoteResolverDependencies) {
    super("PSE-FRAMES", {

      representativeTicker: "PSE:BDO",
      routingDescription: "PSE frames quote lookup",
    });
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.exchange === "PSE";
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof EquityRequest)) {
      return {};
    }

    return buildPseQuoteRouteState(request);
  }

  getRouteClass(_request: RequestInput | ResolvedRequest): string {
    return "EQUITY -> PSE";
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const requests: Array<{
      cacheKey: string;
      index: number;
      symbol: string;
      url: string;
    }> = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const symbol = String(job.routeState.symbol || "").trim().toUpperCase();
      const cacheKey = buildPseQuoteCacheKey(symbol);
      const cached = this.getCachedJson(cacheKey);

      if (cached) {
        results[i] = createRouteResult("success", {
          quote: cached,
        });
        continue;
      }

      requests.push({
        cacheKey,
        index: i,
        symbol,
        url: buildPseSecurityFrameUrl(symbol),
      });
    }

    if (!requests.length) {
      return results as unknown as Array<Record<string, unknown> | null>;
    }

    const responses = this.fetchAllInChunks("pse", requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error &&
                responseItem.error.message
                ? responseItem.error.message
                : responseItem.error,
            ),
          },
        );
        continue;
      }

      try {
        const quote = extractPseFrameQuoteFromResponse(
          responseItem.response as PseQuoteResponseLike,
          responseItem.request.symbol,
        );
        this.putCachedJson(
          responseItem.request.cacheKey,
          quote,
          PSE_QUOTE_CACHE_TTL_SECONDS,
        );
        results[responseItem.request.index] = createRouteResult("success", {
          quote,
        });
      } catch (error) {
        if (isPseListingNotFoundError(error) || isPseUnavailableError(error)) {
          results[responseItem.request.index] = createRouteResult(
            "lookup_failure",
            {
              error,
            },
          );
          continue;
        }

        results[responseItem.request.index] = createRouteResult(
          "terminal_error",
          {
            error,
          },
        );
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: PseQuoteResolverDependencies,
  ): PseFramesResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "PseFramesResolver requires fetchAllInChunks, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

export class PseEdgeResolver extends RouteExecutionResolver {
  readonly fetchAllInChunks: PseQuoteResolverDependencies["fetchAllInChunks"];
  readonly getCachedJson: PseQuoteResolverDependencies["getCachedJson"];
  readonly putCachedJson: PseQuoteResolverDependencies["putCachedJson"];

  constructor(deps: PseQuoteResolverDependencies) {
    super("PSE-EDGE", {

      representativeTicker: "PSE:BDO",
      routingDescription: "PSE edge quote lookup",
    });
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.exchange === "PSE";
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof EquityRequest)) {
      return {};
    }

    return buildPseQuoteRouteState(request);
  }

  getRouteClass(_request: RequestInput | ResolvedRequest): string {
    return "EQUITY -> PSE";
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const searchRequests: Array<{
      cacheKey: string;
      index: number;
      symbol: string;
      url: string;
    }> = [];
    const stockRequests: Array<{
      cacheKey: string;
      index: number;
      listing: PseListing;
      symbol: string;
      url: string;
    }> = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const symbol = String(job.routeState.symbol || "").trim().toUpperCase();
      const cacheKey = buildPseQuoteCacheKey(symbol);
      const cached = this.getCachedJson(cacheKey);

      if (cached) {
        results[i] = createRouteResult("success", {
          quote: cached,
        });
        continue;
      }

      const cachedListing = normalizePseListing(
        this.getCachedJson(buildPseListingCacheKey(symbol)),
      );

      if (cachedListing) {
        job.routeState.listing = cachedListing;
        stockRequests.push({
          cacheKey,
          index: i,
          listing: cachedListing,
          symbol,
          url: buildPseStockDataUrl(cachedListing),
        });
        continue;
      }

      searchRequests.push({
        cacheKey: buildPseListingCacheKey(symbol),
        index: i,
        symbol,
        url: buildPseSearchUrl(symbol),
      });
    }

    if (!searchRequests.length && !stockRequests.length) {
      return results as unknown as Array<Record<string, unknown> | null>;
    }

    const searchResponses = this.fetchAllInChunks("pse", searchRequests);

    for (const responseItem of searchResponses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error &&
                responseItem.error.message
                ? responseItem.error.message
                : responseItem.error,
            ),
          },
        );
        continue;
      }

      try {
        const listing = tryResolvePseListingFromHtml(
          responseItem.response ? responseItem.response.getContentText() : "",
          responseItem.request.symbol,
        );

        if (!listing) {
          results[responseItem.request.index] = createRouteResult(
            "lookup_failure",
            {
              error: new Error(
                `No PSE listing was found for "${responseItem.request.symbol}".`,
              ),
            },
          );
          continue;
        }

        this.putCachedJson(
          responseItem.request.cacheKey,
          listing,
          PSE_LISTING_CACHE_TTL_SECONDS,
        );
        const searchJob = jobs[responseItem.request.index];
        if (!searchJob) {
          throw new Error("Route job is missing for PSE listing response.");
        }

        searchJob.routeState.listing = listing;
        stockRequests.push({
          cacheKey: buildPseQuoteCacheKey(responseItem.request.symbol),
          index: responseItem.request.index,
          listing,
          symbol: responseItem.request.symbol,
          url: buildPseStockDataUrl(listing),
        });
      } catch (error) {
        results[responseItem.request.index] = createRouteResult(
          "terminal_error",
          {
            error,
          },
        );
      }
    }

    const stockResponses = this.fetchAllInChunks("pse", stockRequests);

    for (const responseItem of stockResponses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error &&
                responseItem.error.message
                ? responseItem.error.message
                : responseItem.error,
            ),
          },
        );
        continue;
      }

      try {
        const listing = normalizePseListing(responseItem.request.listing);
        const quote = extractPseQuoteFromResponse(
          responseItem.response as PseQuoteResponseLike,
          listing,
        );
        const stockJob = jobs[responseItem.request.index];

        if (!quote || !quote.symbol) {
          const tickerInput = stockJob ? stockJob.tickerInput : "";
          throw new Error(
            `No PSE quote data was found for ${tickerInput}.`,
          );
        }

        this.putCachedJson(
          responseItem.request.cacheKey,
          quote,
          PSE_QUOTE_CACHE_TTL_SECONDS,
        );
        results[responseItem.request.index] = createRouteResult("success", {
          quote,
        });
      } catch (error) {
        if (isPseListingNotFoundError(error) || isPseUnavailableError(error)) {
          results[responseItem.request.index] = createRouteResult(
            "lookup_failure",
            {
              error,
            },
          );
          continue;
        }

        results[responseItem.request.index] = createRouteResult(
          "terminal_error",
          {
            error,
          },
        );
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: PseQuoteResolverDependencies,
  ): PseEdgeResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "PseEdgeResolver requires fetchAllInChunks, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

export class YahooQuoteResolver extends RouteExecutionResolver {
  readonly fetchAllInChunks: YahooQuoteResolverDependencies["fetchAllInChunks"];
  readonly getCachedJson: YahooQuoteResolverDependencies["getCachedJson"];
  readonly putCachedJson: YahooQuoteResolverDependencies["putCachedJson"];

  constructor(deps: YahooQuoteResolverDependencies) {
    super("YAHOO", "YAHOO", {

      representativeTicker: "GOOG",
      routingDescription: "Yahoo quote lookup",
    });
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      (request instanceof EquityRequest &&
        request.exchange !== "PSE" &&
        !!request.yahooSymbol) ||
      (request instanceof FxRequest &&
        !!request.fxPair &&
        !!request.fxPair.yahooChartSymbol)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (request instanceof FxRequest) {
      return {
        fxPair: request.fxPair,
        yahooSymbol: request.fxPair.yahooChartSymbol,
      };
    }

    if (request instanceof EquityRequest) {
      return {
        fxPair: null,
        yahooSymbol: request.yahooSymbol,
      };
    }

    return {};
  }

  getRouteClass(request: RequestInput | ResolvedRequest): string {
    return request instanceof FxRequest ? "FORCED:YAHOO" : "TICKER";
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const requests: Array<{
      cacheKey: string;
      index: number;
      url: string;
      yahooSymbol: string;
    }> = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const yahooSymbol = String(job.routeState.yahooSymbol || "").trim();
      const preferredYahooSymbol = String(
        job.routeState.preferredYahooSymbol || "",
      ).trim();
      const lookupYahooSymbol = preferredYahooSymbol || yahooSymbol;
      const cacheKey = `hoodlefinance:${lookupYahooSymbol}`;
      const cached = this.getCachedJson(cacheKey);

      if (cached) {
        results[i] = createRouteResult("success", {
          quote: decorateFxQuote(
            cached as Record<string, unknown>,
            (job.routeState.fxPair as FxRequest["fxPair"] | null) || null,
          ),
        });
        continue;
      }

      requests.push({
        cacheKey,
        index: i,
        url: buildYahooChartUrl(lookupYahooSymbol),
        yahooSymbol: lookupYahooSymbol,
      });
    }

    const responses = this.fetchAllInChunks("yahoo-chart", requests);

    for (const responseItem of responses) {
      let error: unknown = responseItem.error || null;

      if (!error) {
        try {
          const job = jobs[responseItem.request.index];
          if (!job) {
            throw new Error("Route job is missing for Yahoo quote response.");
          }

          const quote = decorateFxQuote(
            extractYahooQuoteMetaFromResponse(
              responseItem.response as YahooQuoteResponseLike,
              job.tickerInput || responseItem.request.yahooSymbol,
            ),
            (job.routeState.fxPair as FxRequest["fxPair"] | null) || null,
          );
          this.putCachedJson(
            responseItem.request.cacheKey,
            extractRawQuote(quote),
            60,
          );
          results[responseItem.request.index] = createRouteResult("success", {
            quote,
          });
          continue;
        } catch (extractError) {
          error = extractError;
        }
      }

      const errorMessage = String(
        error instanceof Error ? error.message : error ?? "",
      );
      results[responseItem.request.index] = createRouteResult(
        /No quote data was found|Quote lookup failed/i.test(errorMessage)
          ? "lookup_failure"
          : "terminal_error",
        {
          error,
        },
      );
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: YahooQuoteResolverDependencies,
  ): YahooQuoteResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "YahooQuoteResolver requires fetchAllInChunks, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

export class TradingviewFundResolver extends RouteExecutionResolver {
  readonly fetchAllInChunks:
    | TradingviewFundResolverDependencies["fetchAllInChunks"];
  readonly getCachedJson: TradingviewFundResolverDependencies["getCachedJson"];
  readonly putCachedJson: TradingviewFundResolverDependencies["putCachedJson"];

  constructor(deps: TradingviewFundResolverDependencies) {
    super("TRADINGVIEW-FUND", "TRADINGVIEW", "TRADINGVIEW", {
      representativeTicker: "TLV:KSMF59",
      routingDescription: "TradingView fund quote lookup",
    });
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.allowTradingviewFallback;
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof EquityRequest)) {
      return {};
    }

    return {
      yahooSymbol: request.yahooSymbol,
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const requests: Array<{
      cacheKey: string;
      expectedSymbol: string;
      index: number;
      primaryCacheKey: string;
      url: string;
      yahooSymbol: string;
    }> = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const fallbackInfo = buildIsraeliFundTradingviewFallbackInfo(
        String(job.routeState.yahooSymbol || ""),
      );
      const cacheKey = `hoodlefinance:tradingview:quote:${fallbackInfo.yahooSymbol}`;
      const primaryCacheKey = `hoodlefinance:${fallbackInfo.yahooSymbol}`;
      const cached = this.getCachedJson(cacheKey);

      if (cached) {
        this.putCachedJson(primaryCacheKey, cached, 60);
        results[i] = createRouteResult("success", {
          quote: cached,
        });
        continue;
      }

      requests.push({
        cacheKey,
        expectedSymbol: fallbackInfo.expectedSymbol,
        index: i,
        primaryCacheKey,
        url: fallbackInfo.url,
        yahooSymbol: fallbackInfo.yahooSymbol,
      });
    }

    const responses = this.fetchAllInChunks("tradingview-quote", requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult("terminal_error", {
          error: responseItem.error,
        });
        continue;
      }

      try {
        const quote = extractTradingviewFundQuoteFromResponse(
          responseItem.response as TradingviewQuoteResponseLike,
          responseItem.request.yahooSymbol,
          responseItem.request.expectedSymbol,
        );
        this.putCachedJson(responseItem.request.cacheKey, quote, 60);
        this.putCachedJson(responseItem.request.primaryCacheKey, quote, 60);
        results[responseItem.request.index] = createRouteResult("success", {
          quote,
        });
      } catch (error) {
        results[responseItem.request.index] = createRouteResult("terminal_error", {
          error,
        });
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: TradingviewFundResolverDependencies,
  ): TradingviewFundResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "TradingviewFundResolver requires fetchAllInChunks, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  DirectIdentifierResolver,
  LocalFxResolver,
  GoogleFxResolver,
  PSEFramesResolver: PseFramesResolver,
  PSEEdgeResolver: PseEdgeResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
} as const;

export interface ConcreteResolverMaterializationDependencies {
  googleFx?: GoogleFxResolverDependencies;
  pseQuotes?: PseQuoteResolverDependencies;
  resolvePseTickerFromIsinMap?: ResolvePseTickerFromIsinMap;
  yahooIsinSearch?: YahooIsinSearchResolverDependencies;
  yahooQuote?: YahooQuoteResolverDependencies;
  tradingviewFund?: TradingviewFundResolverDependencies;
}

export function createConcreteResolverMaterializationDependencies(
  deps: ConcreteResolverMaterializationDependencies,
): {
  resolverClassDependenciesByName: Record<string, unknown>;
  resolverClassesByName: Record<string, ResolverClassLike>;
} {
  return {
    resolverClassDependenciesByName: {
      GoogleFxResolver: deps.googleFx,
      PSEFramesResolver: deps.pseQuotes,
      PSEEdgeResolver: deps.pseQuotes,
      PseIsinMapResolver: deps.resolvePseTickerFromIsinMap,
      YahooIsinSearchResolver: deps.yahooIsinSearch,
      YahooQuoteResolver: deps.yahooQuote,
      TradingviewFundResolver: deps.tradingviewFund,
    },
    resolverClassesByName: {
      ...CONCRETE_RESOLVER_CLASSES_BY_NAME,
    },
  };
}
