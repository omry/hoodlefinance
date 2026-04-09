import {
  EquityRequest,
  FxRequest,
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";
import {
  buildEquityYahooQuoteRouteState,
  buildIsinIdentifierRouteState,
  buildPseQuoteRouteState,
} from "./route-state";
import { IdentifierResolver, RouteExecutionResolver } from "./resolver-classes";
import {
  createRequestInput,
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
import { createStoredFxTickerParser } from "./fx-normalization";
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
} from "./pse-quotes";
import {
  buildYahooIsinSearchUrl,
  extractYahooSymbolFromSearchResponse,
} from "./yahoo-isin-search";
import {
  buildYahooChartUrl,
  extractYahooQuoteMetaFromResponse,
} from "./yahoo-quote";
import {
  createPreferredYahooSymbolResolver,
  PREFERRED_REIT_WHITELIST_CACHE_KEY,
  PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
  PREFERRED_REIT_WHITELIST_REFRESH_INTERVAL_MS,
  PREFERRED_REIT_WHITELIST_STORED_KEY,
  PREFERRED_REIT_WHITELIST_URL,
  tryParsePreferredReitTickerSet,
} from "./preferred-yahoo-symbols";
import {
  buildIsraeliFundTradingviewFallbackInfo,
  extractTradingviewFundQuoteFromResponse,
} from "./tradingview-fund";
import {
  createResolutionFailure,
  createResolutionSuccess,
  createRouteResult,
  type RouteResult,
} from "./route-results";
import type { ResolverNode, RouteJob, RuntimePlan } from "./planner";
import type { ResolverClass } from "./resolver-materialization";
import { buildFxQuoteRouteState } from "./route-state";
import {
  loadStoredTextResource,
  type ResolverServices,
} from "./resolver-services";
import {
  type TextHttpResponse,
} from "./text-http-response";

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
          (error) =>
            String(error instanceof Error ? error.message : (error ?? "")),
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
          String(
            caughtError instanceof Error
              ? caughtError.message
              : (caughtError ?? ""),
          ),
      );
    }
  }

  static fromSpec(_code: string): DirectIdentifierResolver {
    return new this();
  }
}

export class RequestClassifierResolver extends IdentifierResolver {
  private fxTickerParser:
    | ((ticker: string) => ReturnType<typeof createRequestInput>["fxPair"])
    | null
    | undefined;

  constructor() {
    super("CLASSIFY-REQUEST");
  }

  canHandle(input: RequestInput | RawRequestInput | ResolvedRequest): boolean {
    return input instanceof RawRequestInput;
  }

  buildRuntimePlan(
    _input: RequestInput | RawRequestInput | ResolvedRequest,
  ): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.name,
      routeState: {},
    };
  }

  initEnv(services: ResolverServices): void {
    this.fxTickerParser = createStoredFxTickerParser(services);
  }

  resolve(input: RequestInput | RawRequestInput | ResolvedRequest) {
    const startedAtMs = Date.now();

    try {
      if (!this.canHandle(input)) {
        return createResolutionFailure(
          "Request classification requires raw input.",
          Date.now() - startedAtMs,
          (error) =>
            String(error instanceof Error ? error.message : (error ?? "")),
        );
      }

      const rawInput = input as RawRequestInput;
      const requestInput = this.fxTickerParser
        ? createRequestInput(rawInput.identifier, rawInput.attribute, {
            parseFxTicker: this.fxTickerParser,
          })
        : createRequestInput(rawInput.identifier, rawInput.attribute);

      return createResolutionSuccess(requestInput, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        (caughtError) =>
          String(
            caughtError instanceof Error
              ? caughtError.message
              : (caughtError ?? ""),
          ),
      );
    }
  }

  static fromSpec(_code: string): RequestClassifierResolver {
    return new this();
  }
}

export interface YahooIsinSearchRequest {
  cacheKey: string;
  index: number;
  isin: string;
  url: string;
}

export interface YahooIsinSearchBatchResponse {
  error?: unknown;
  request: YahooIsinSearchRequest;
  response?: TextHttpResponse;
}

interface SequentialFetchRequestLike {
  url: string;
}

const PSE_ISIN_MAP_CACHE_KEY = "hoodlefinance:ts:pseIsinMap";
const PSE_ISIN_MAP_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PSE_ISIN_MAP_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PSE_ISIN_MAP_STORED_KEY = "hoodlefinance.pseIsinMap";
const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
function fetchRequestsSequentially<TRequest extends SequentialFetchRequestLike>(
  httpFetch: (url: string) => TextHttpResponse,
  requests: TRequest[],
): Array<{
  error?: unknown;
  request: TRequest;
  response?: TextHttpResponse;
}> {
  return requests.map((request) => {
    try {
      return {
        request,
        response: httpFetch(request.url),
      };
    } catch (error) {
      return {
        error,
        request,
      };
    }
  });
}

function parsePropertiesMap(text: string): Record<string, string> {
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

function tryParsePropertiesMap(
  text: string | null | undefined,
): Record<string, string> | null {
  const rawText = String(text || "");

  if (!rawText.trim()) {
    return null;
  }

  const parsed = parsePropertiesMap(rawText);

  return Object.keys(parsed).length > 0 ? parsed : null;
}

export class PseIsinMapResolver extends IdentifierResolver {
  readonly traceLabel: string;
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedString?: ResolverServices["getCachedString"];
  getStoredTextResource?: ResolverServices["getStoredTextResource"];
  putCachedString?: ResolverServices["putCachedString"];
  putStoredTextResource?: ResolverServices["putStoredTextResource"];
  pseIsinMapByIsin: Record<string, string> | null;

  constructor() {
    super("ISIN:PSE");
    this.traceLabel = "ISIN:PSE";
    this.pseIsinMapByIsin = null;
  }

  initEnv(services: ResolverServices): void {
    if (typeof services.httpFetch !== "function") {
      throw new Error("PseIsinMapResolver requires httpFetch.");
    }

    this.httpFetch = services.httpFetch;
    this.getCachedString = services.getCachedString;
    this.getStoredTextResource = services.getStoredTextResource;
    this.putCachedString = services.putCachedString;
    this.putStoredTextResource = services.putStoredTextResource;
  }

  ensurePseIsinMap(): Record<string, string> {
    if (this.pseIsinMapByIsin) {
      return this.pseIsinMapByIsin;
    }

    this.pseIsinMapByIsin = loadStoredTextResource({
      cacheKey: PSE_ISIN_MAP_CACHE_KEY,
      cacheTtlSeconds: PSE_ISIN_MAP_CACHE_TTL_SECONDS,
      fetchText: () => this.httpFetch(PSE_ISIN_MAP_URL).getContentText(),
      getCachedString: this.getCachedString,
      getStoredTextResource: this.getStoredTextResource,
      invalidPayloadMessage: "Invalid PSE ISIN map payload.",
      putCachedString: this.putCachedString,
      putStoredTextResource: this.putStoredTextResource,
      refreshIntervalMs: PSE_ISIN_MAP_REFRESH_INTERVAL_MS,
      storedResourceKey: PSE_ISIN_MAP_STORED_KEY,
      tryParse: tryParsePropertiesMap,
    }).parsed;

    return this.pseIsinMapByIsin;
  }

  getRoutingDescription(): string | null {
    return "PSE ISIN map lookup";
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    const isin = extractIsinFromRequestInput(
      input as Pick<RequestInput, "ticker">,
    );

    return input instanceof RequestInput && isin.startsWith("PH");
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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
        const pseTicker =
          this.ensurePseIsinMap()[
            String(isin || "")
              .trim()
              .toUpperCase()
          ] || "";

        if (!pseTicker) {
          results.push(createRouteResult("lookup_failure"));
          continue;
        }

        results.push(
          createRouteResult("success", {
            value: buildTypedRequestFromResolvedTicker(
              job.routeState.input as Pick<
                RequestInput,
                "attribute" | "identifier"
              >,
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

  static fromSpec(_code: string): PseIsinMapResolver {
    return new this();
  }
}

export class YahooIsinSearchResolver extends IdentifierResolver {
  readonly traceLabel: string;
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedString!: NonNullable<ResolverServices["getCachedString"]>;
  putCachedString!: NonNullable<ResolverServices["putCachedString"]>;

  constructor() {
    super("ISIN:YAHOO");
    this.traceLabel = "ISIN:YAHOO";
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedString !== "function" ||
      typeof services.putCachedString !== "function"
    ) {
      throw new Error(
        "YahooIsinSearchResolver requires httpFetch, getCachedString, and putCachedString.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedString = services.getCachedString;
    this.putCachedString = services.putCachedString;
  }

  getRoutingDescription(): string | null {
    return "Yahoo search by ISIN";
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return (
      input instanceof RequestInput && !!extractIsinFromRequestInput(input)
    );
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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
            job.routeState.input as Pick<
              RequestInput,
              "attribute" | "identifier"
            >,
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

    const responses = fetchRequestsSequentially(this.httpFetch, requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: responseItem.error,
          },
        );
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
          responseItem.response as TextHttpResponse,
          responseItem.request.isin,
        );
        this.putCachedString(
          responseItem.request.cacheKey,
          resolvedTicker,
          21600,
        );
        results[responseItem.request.index] = createRouteResult("success", {
          value: buildTypedRequestFromResolvedTicker(
            job.routeState.input as Pick<
              RequestInput,
              "attribute" | "identifier"
            >,
            resolvedTicker,
            0,
          ),
        });
      } catch (error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error,
          },
        );
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(_code: string): YahooIsinSearchResolver {
    return new this();
  }
}

export class LocalFxResolver extends RouteExecutionResolver {
  constructor() {
    super("FX-IDENTITY");
  }

  getRoutingDescription(): string | null {
    return "Same-currency FX identity rate";
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

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
    if (!this.canHandle(request)) {
      return {};
    }

    const fxRequest = request as Extract<
      ResolvedRequest,
      { requestType: "fx" }
    >;

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
            quote: buildSameCurrencyQuote(
              job.routeState.fxPair as import("./request").FxPair,
            ),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(_code: string): LocalFxResolver {
    return new this();
  }
}

export class GoogleFxResolver extends RouteExecutionResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor() {
    super("GOOGLE-FX");
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedJson !== "function" ||
      typeof services.putCachedJson !== "function"
    ) {
      throw new Error(
        "GoogleFxResolver requires httpFetch, getCachedJson, and putCachedJson.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedJson = services.getCachedJson;
    this.putCachedJson = services.putCachedJson;
  }

  getExampleInput(): string | null {
    return "EURUSD";
  }

  getRoutingDescription(): string | null {
    return "Google Finance FX quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      request instanceof FxRequest &&
      !!request.fxPair &&
      !isSameCurrencyFxPair(request.fxPair)
    );
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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
            quote: decorateFxQuote(cached as Record<string, unknown>, fxPair),
          });
          continue;
        }

        const quote = extractGoogleFinanceFxPairQuote(
          this.httpFetch(buildGoogleFinanceQuoteUrl(pairSlug)),
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

  static fromSpec(_code: string): GoogleFxResolver {
    return new this();
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
  const symbol = String(listing.symbol || "")
    .trim()
    .toUpperCase();
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
  return `hoodlefinance:pse:${String(symbol || "")
    .trim()
    .toUpperCase()}`;
}

export class PseFramesResolver extends RouteExecutionResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor() {
    super("PSE-FRAMES");
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedJson !== "function" ||
      typeof services.putCachedJson !== "function"
    ) {
      throw new Error(
        "PseFramesResolver requires httpFetch, getCachedJson, and putCachedJson.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedJson = services.getCachedJson;
    this.putCachedJson = services.putCachedJson;
  }

  getExampleInput(): string | null {
    return "PSE:BDO";
  }

  getRoutingDescription(): string | null {
    return "PSE frames quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.exchange === "PSE";
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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

      const symbol = String(job.routeState.symbol || "")
        .trim()
        .toUpperCase();
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

    const responses = fetchRequestsSequentially(this.httpFetch, requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error && responseItem.error.message
                ? responseItem.error.message
                : responseItem.error,
            ),
          },
        );
        continue;
      }

      try {
        const quote = extractPseFrameQuoteFromResponse(
          responseItem.response as TextHttpResponse,
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

  static fromSpec(_code: string): PseFramesResolver {
    return new this();
  }
}

export class PseEdgeResolver extends RouteExecutionResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor() {
    super("PSE-EDGE");
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedJson !== "function" ||
      typeof services.putCachedJson !== "function"
    ) {
      throw new Error(
        "PseEdgeResolver requires httpFetch, getCachedJson, and putCachedJson.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedJson = services.getCachedJson;
    this.putCachedJson = services.putCachedJson;
  }

  getExampleInput(): string | null {
    return "PSE:BDO";
  }

  getRoutingDescription(): string | null {
    return "PSE edge quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.exchange === "PSE";
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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

      const symbol = String(job.routeState.symbol || "")
        .trim()
        .toUpperCase();
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

    const searchResponses = fetchRequestsSequentially(
      this.httpFetch,
      searchRequests,
    );

    for (const responseItem of searchResponses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error && responseItem.error.message
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

    const stockResponses = fetchRequestsSequentially(
      this.httpFetch,
      stockRequests,
    );

    for (const responseItem of stockResponses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "lookup_failure",
          {
            error: buildPseUnavailableError(
              responseItem.error instanceof Error && responseItem.error.message
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
          responseItem.response as TextHttpResponse,
          listing,
        );
        const stockJob = jobs[responseItem.request.index];

        if (!quote || !quote.symbol) {
          const tickerInput = stockJob ? stockJob.tickerInput : "";
          throw new Error(`No PSE quote data was found for ${tickerInput}.`);
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

  static fromSpec(_code: string): PseEdgeResolver {
    return new this();
  }
}

export class YahooQuoteResolver extends RouteExecutionResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedString?: ResolverServices["getCachedString"];
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  getStoredTextResource?: ResolverServices["getStoredTextResource"];
  putCachedString?: ResolverServices["putCachedString"];
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;
  putStoredTextResource?: ResolverServices["putStoredTextResource"];
  preferredReitTickerSet: ReadonlySet<string> | null;

  constructor() {
    super("YAHOO");
    this.preferredReitTickerSet = null;
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedJson !== "function" ||
      typeof services.putCachedJson !== "function"
    ) {
      throw new Error(
        "YahooQuoteResolver requires httpFetch, getCachedJson, and putCachedJson.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedString = services.getCachedString;
    this.getCachedJson = services.getCachedJson;
    this.getStoredTextResource = services.getStoredTextResource;
    this.putCachedString = services.putCachedString;
    this.putCachedJson = services.putCachedJson;
    this.putStoredTextResource = services.putStoredTextResource;
  }

  getExampleInput(): string | null {
    return "GOOG";
  }

  getRoutingDescription(): string | null {
    return "Yahoo quote lookup";
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

  ensurePreferredReitTickerSet(): ReadonlySet<string> {
    if (this.preferredReitTickerSet) {
      return this.preferredReitTickerSet;
    }

    this.preferredReitTickerSet = loadStoredTextResource({
      cacheKey: PREFERRED_REIT_WHITELIST_CACHE_KEY,
      cacheTtlSeconds: PREFERRED_REIT_WHITELIST_CACHE_TTL_SECONDS,
      fetchText: () =>
        this.httpFetch(PREFERRED_REIT_WHITELIST_URL).getContentText(),
      getCachedString: this.getCachedString,
      getStoredTextResource: this.getStoredTextResource,
      invalidPayloadMessage: "Invalid preferred REIT whitelist payload.",
      putCachedString: this.putCachedString,
      putStoredTextResource: this.putStoredTextResource,
      refreshIntervalMs: PREFERRED_REIT_WHITELIST_REFRESH_INTERVAL_MS,
      storedResourceKey: PREFERRED_REIT_WHITELIST_STORED_KEY,
      tryParse: tryParsePreferredReitTickerSet,
    }).parsed;

    return this.preferredReitTickerSet;
  }

  buildPreferredYahooSymbol(yahooSymbol: string): string {
    try {
      return createPreferredYahooSymbolResolver(
        this.ensurePreferredReitTickerSet(),
      )(yahooSymbol);
    } catch {
      return "";
    }
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
    if (request instanceof FxRequest) {
      return {
        fxPair: request.fxPair,
        yahooSymbol: request.fxPair.yahooChartSymbol,
      };
    }

    if (request instanceof EquityRequest) {
      return buildEquityYahooQuoteRouteState(
        request,
        this.buildPreferredYahooSymbol(request.yahooSymbol),
      );
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

    const responses = fetchRequestsSequentially(this.httpFetch, requests);

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
              responseItem.response as TextHttpResponse,
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
        error instanceof Error ? error.message : (error ?? ""),
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

  static fromSpec(_code: string): YahooQuoteResolver {
    return new this();
  }
}

export class TradingviewFundResolver extends RouteExecutionResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor() {
    super("TRADINGVIEW-FUND", "TRADINGVIEW");
  }

  initEnv(services: ResolverServices): void {
    if (
      typeof services.httpFetch !== "function" ||
      typeof services.getCachedJson !== "function" ||
      typeof services.putCachedJson !== "function"
    ) {
      throw new Error(
        "TradingviewFundResolver requires httpFetch, getCachedJson, and putCachedJson.",
      );
    }

    this.httpFetch = services.httpFetch;
    this.getCachedJson = services.getCachedJson;
    this.putCachedJson = services.putCachedJson;
  }

  getExampleInput(): string | null {
    return "TLV:KSMF59";
  }

  getRoutingDescription(): string | null {
    return "TradingView fund quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return request instanceof EquityRequest && request.allowTradingviewFallback;
  }

  buildRouteState(
    request: RequestInput | ResolvedRequest,
  ): Record<string, unknown> {
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

    const responses = fetchRequestsSequentially(this.httpFetch, requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult(
          "terminal_error",
          {
            error: responseItem.error,
          },
        );
        continue;
      }

      try {
        const quote = extractTradingviewFundQuoteFromResponse(
          responseItem.response as TextHttpResponse,
          responseItem.request.yahooSymbol,
          responseItem.request.expectedSymbol,
        );
        this.putCachedJson(responseItem.request.cacheKey, quote, 60);
        this.putCachedJson(responseItem.request.primaryCacheKey, quote, 60);
        results[responseItem.request.index] = createRouteResult("success", {
          quote,
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

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(_code: string): TradingviewFundResolver {
    return new this();
  }
}

export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  DirectIdentifierResolver,
  LocalFxResolver,
  GoogleFxResolver,
  PSEFramesResolver: PseFramesResolver,
  PSEEdgeResolver: PseEdgeResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
} as const;

export function createConcreteResolverMaterializationDependencies(
  resolverServices: ResolverServices,
): {
  resolverClassesByName: Record<string, ResolverClass>;
  resolverServices: ResolverServices;
} {
  return {
    resolverClassesByName: {
      ...CONCRETE_RESOLVER_CLASSES_BY_NAME,
    },
    resolverServices,
  };
}
