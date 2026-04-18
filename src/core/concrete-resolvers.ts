import {
  EquityRequest,
  FxRequest,
  looksLikeIsin,
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";
import { IdentifierResolver, Resolver, BaseHFResolver } from "./resolver-classes";
import {
  createRequestInput,
  buildTypedRequestFromParsedInput,
  buildTypedRequestFromResolvedTicker,
  extractIsinFromRequestInput,
} from "./request-building";
import {
  buildSameCurrencyQuote,
  decorateFxQuote,
  isSameCurrencyFxPair,
} from "./fx-quotes";
import { StockQuote, FxQuote } from "./quote";
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
import { extractAttributeValue } from "./attribute-extraction";
import { resolveIsinAttributeValue } from "./isin-lookup";
import { resolveLonIsin } from "./isin-sources";
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
  resolveCanonicalCurrencyCode,
  resolveFxConversionRate,
  type PlanRuntimeRefs,
  type ResolutionResult,
} from "./core-resolvers";
import {
  loadStoredTextResource,
  type ResolverServices,
} from "./resolver-services";
import {
  type TextHttpResponse,
} from "./text-http-response";
import { parseAttributeRequest } from "./request-parsing";

const NORMALIZABLE_MONEY_ATTRIBUTES = new Set([
  "price",
  "high",
  "low",
  "close",
  "change",
]);

function convertResolvedMoneyValue(
  value: unknown,
  quote: StockQuote | FxQuote,
  attribute: string,
  runtimeRefs: PlanRuntimeRefs | null,
): unknown {
  const attributeRequest = parseAttributeRequest(attribute);
  const baseAttribute = attributeRequest.baseAttribute;
  const sourceCurrency = String(
    quote.currency || (quote as StockQuote).financialCurrency || "",
  ).trim();

  if (baseAttribute === "currency") {
    return resolveCanonicalCurrencyCode(sourceCurrency);
  }

  if (
    !(quote instanceof StockQuote) ||
    !NORMALIZABLE_MONEY_ATTRIBUTES.has(baseAttribute) ||
    !sourceCurrency
  ) {
    return value;
  }

  const targetCurrency = attributeRequest.wantsOutputCurrency
    ? attributeRequest.outputCode.trim().toUpperCase()
    : resolveCanonicalCurrencyCode(sourceCurrency);

  if (!targetCurrency || sourceCurrency === targetCurrency) {
    return value;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  if (!runtimeRefs) {
    throw new Error(
      `FX conversion runtime is unavailable for "${sourceCurrency}" -> "${targetCurrency}".`,
    );
  }

  const fxResult = resolveFxConversionRate(
    runtimeRefs,
    sourceCurrency,
    targetCurrency,
  );

  if (fxResult.status !== "success") {
    throw new Error(String(fxResult.error || "FX conversion failed.").trim());
  }

  const rate = Number(fxResult.value);
  if (!Number.isFinite(rate)) {
    throw new Error(
      `FX conversion from "${sourceCurrency}" to "${targetCurrency}" returned a non-numeric rate.`,
    );
  }

  return value * rate;
}

function extractRawResolvedAttributeValue(
  quote: StockQuote | FxQuote,
  attribute: string,
): unknown {
  const attributeRequest = parseAttributeRequest(attribute);

  if (
    attributeRequest.wantsOutputCurrency &&
    attributeRequest.baseAttribute === "price"
  ) {
    return extractAttributeValue(quote, "price");
  }

  return extractAttributeValue(quote, attribute);
}

export class DirectIdentifierResolver extends IdentifierResolver {
  constructor(code: string) {
    super(code);
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

  static fromSpec(code: string): DirectIdentifierResolver {
    return new this(code);
  }
}

export interface ClassifiedInput {
  requestInput: RequestInput;
  resolvedRequest: ResolvedRequest | null;
}

export class RequestClassifierResolver extends IdentifierResolver {
  private fxTickerParser:
    | ((ticker: string) => ReturnType<typeof createRequestInput>["fxPair"])
    | null
    | undefined;

  constructor(code = "ROOT") {
    super(code);
  }

  canHandle(input: RequestInput | RawRequestInput | ResolvedRequest): boolean {
    return input instanceof RawRequestInput;
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

      // Absorb DirectIdentifierResolver: for non-ISIN inputs resolve inline.
      const isIsin = !!extractIsinFromRequestInput(requestInput);
      const resolvedRequest = isIsin
        ? null
        : buildTypedRequestFromParsedInput(requestInput, requestInput, Math.max(0, Date.now() - startedAtMs));

      const result: ClassifiedInput = { requestInput, resolvedRequest };
      return createResolutionSuccess(result, Date.now() - startedAtMs);
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

  static fromSpec(code: string): RequestClassifierResolver {
    return new this(code);
  }
}

export class FirstSuccessReceiver extends IdentifierResolver {
  constructor(code = "ISIN-RECEIVER") {
    super(code);
  }

  // Pass-through: ISIN-RECEIVER is a convergence node. After an ISIN lookup
  // produces a ResolvedRequest, it forwards it unchanged to the ATTRIBUTE branch.
  override resolve(request: unknown): ResolutionResult<unknown> {
    const startedAtMs = Date.now();
    return createResolutionSuccess(request as object, Date.now() - startedAtMs);
  }

  static fromSpec(code: string): FirstSuccessReceiver {
    return new this(code);
  }
}

const PSE_ISIN_MAP_CACHE_KEY = "hoodlefinance:ts:pseIsinMap";
const PSE_ISIN_MAP_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PSE_ISIN_MAP_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PSE_ISIN_MAP_STORED_KEY = "hoodlefinance.pseIsinMap";
const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
function fetchRequestsSequentially<TRequest extends { url: string }>(
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

  constructor(code = "ISIN:PSE") {
    super(code);
    this.traceLabel = code;
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

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const isin = String(extractIsinFromRequestInput(request as RequestInput) || "").trim();
    const pseTicker = this.ensurePseIsinMap()[isin.toUpperCase()] || "";

    if (!pseTicker) {
      throw new Error(`No PSE ticker found for ISIN "${isin}".`);
    }

    return buildTypedRequestFromResolvedTicker(
      request as Pick<RequestInput, "attribute" | "identifier">,
      pseTicker,
      0,
    );
  }

  static fromSpec(code: string): PseIsinMapResolver {
    return new this(code);
  }
}

export class YahooIsinSearchResolver extends IdentifierResolver {
  readonly traceLabel: string;
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedString!: NonNullable<ResolverServices["getCachedString"]>;
  putCachedString!: NonNullable<ResolverServices["putCachedString"]>;

  constructor(code = "ISIN:YAHOO") {
    super(code);
    this.traceLabel = code;
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

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const isin = String(extractIsinFromRequestInput(request as RequestInput) || "").trim();
    const cacheKey = `hoodlefinance:isin:${isin}`;
    const cached = this.getCachedString(cacheKey);

    if (cached) {
      return buildTypedRequestFromResolvedTicker(
        request as Pick<RequestInput, "attribute" | "identifier">,
        cached,
        0,
      );
    }

    const responseItem = fetchRequestsSequentially(this.httpFetch, [
      {
        cacheKey,
        isin,
        url: buildYahooIsinSearchUrl(isin),
      },
    ])[0];

    if (responseItem?.error) {
      throw responseItem.error;
    }

    const resolvedTicker = extractYahooSymbolFromSearchResponse(
      responseItem?.response as TextHttpResponse,
      isin,
    );
    this.putCachedString(cacheKey, resolvedTicker, 21600);
    return buildTypedRequestFromResolvedTicker(
      request as Pick<RequestInput, "attribute" | "identifier">,
      resolvedTicker,
      0,
    );
  }

  static fromSpec(code: string): YahooIsinSearchResolver {
    return new this(code);
  }
}

export class LocalFxResolver extends BaseHFResolver {
  constructor(code = "FX-IDENTITY") {
    super(code);
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

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    return buildSameCurrencyQuote((request as FxRequest).fxPair);
  }

  static fromSpec(code: string): LocalFxResolver {
    return new this(code);
  }
}

export class GoogleFxResolver extends BaseHFResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor(code = "GOOGLE-FX") {
    super(code);
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

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const fxPair = (request as FxRequest).fxPair;
    const pairSlug = String(fxPair.googlePairSlug || "").trim();
    const cacheKey = `hoodlefinance:google-finance:${pairSlug}`;
    const cached = this.getCachedJson(cacheKey);

    if (cached) {
      return decorateFxQuote(new StockQuote(cached as never), fxPair);
    }

    const quote = extractGoogleFinanceFxPairQuote(
      this.httpFetch(buildGoogleFinanceQuoteUrl(pairSlug)),
      fxPair,
    );
    this.putCachedJson(cacheKey, quote.toJSON(), 60);
    return decorateFxQuote(quote, fxPair);
  }

  static fromSpec(code: string): GoogleFxResolver {
    return new this(code);
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

export class PseFramesResolver extends BaseHFResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor(code = "PSE-FRAMES") {
    super(code);
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

  getResolverClass(): string {
    return "EQUITY -> PSE";
  }

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const symbol = String((request as EquityRequest).symbol || "")
      .trim()
      .toUpperCase();
    const cacheKey = buildPseQuoteCacheKey(symbol);
    const cached = this.getCachedJson(cacheKey);

    if (cached) {
      return cached;
    }

    const responseItem = fetchRequestsSequentially(this.httpFetch, [
      {
        cacheKey,
        symbol,
        url: buildPseSecurityFrameUrl(symbol),
      },
    ])[0];

    if (responseItem?.error) {
      throw buildPseUnavailableError(
        responseItem.error instanceof Error && responseItem.error.message
          ? responseItem.error.message
          : responseItem.error,
      );
    }

    const quote = extractPseFrameQuoteFromResponse(
      responseItem?.response as TextHttpResponse,
      symbol,
    );
    this.putCachedJson(cacheKey, quote.toJSON(), PSE_QUOTE_CACHE_TTL_SECONDS);
    return quote;
  }

  static fromSpec(code: string): PseFramesResolver {
    return new this(code);
  }
}

export class PseEdgeResolver extends BaseHFResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor(code = "PSE-EDGE") {
    super(code);
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

  getResolverClass(): string {
    return "EQUITY -> PSE";
  }

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const symbol = String((request as EquityRequest).symbol || "")
      .trim()
      .toUpperCase();
    const quoteCacheKey = buildPseQuoteCacheKey(symbol);
    const cachedQuote = this.getCachedJson(quoteCacheKey);

    if (cachedQuote) {
      return cachedQuote;
    }

    let listing: PseListing | null = null;
    if (!listing) {
      const listingCacheKey = buildPseListingCacheKey(symbol);
      listing = normalizePseListing(this.getCachedJson(listingCacheKey));

      if (!listing) {
        const searchResponse = fetchRequestsSequentially(this.httpFetch, [
          {
            cacheKey: listingCacheKey,
            symbol,
            url: buildPseSearchUrl(symbol),
          },
        ])[0];

        if (searchResponse?.error) {
          throw buildPseUnavailableError(
            searchResponse.error instanceof Error && searchResponse.error.message
              ? searchResponse.error.message
              : searchResponse.error,
          );
        }

        listing = tryResolvePseListingFromHtml(
          searchResponse?.response ? searchResponse.response.getContentText() : "",
          symbol,
        );

        if (!listing) {
          throw new Error(`No PSE listing was found for "${symbol}".`);
        }

        this.putCachedJson(
          listingCacheKey,
          listing,
          PSE_LISTING_CACHE_TTL_SECONDS,
        );
      }
    }

    const stockResponse = fetchRequestsSequentially(this.httpFetch, [
      {
        cacheKey: quoteCacheKey,
        listing,
        symbol,
        url: buildPseStockDataUrl(listing),
      },
    ])[0];

    if (stockResponse?.error) {
      throw buildPseUnavailableError(
        stockResponse.error instanceof Error && stockResponse.error.message
          ? stockResponse.error.message
          : stockResponse.error,
      );
    }

    const normalizedListing = normalizePseListing(listing);
    const quote = extractPseQuoteFromResponse(
      stockResponse?.response as TextHttpResponse,
      normalizedListing,
    );

    if (!quote || !quote.symbol) {
      throw new Error(`No PSE quote data was found for ${symbol}.`);
    }

    this.putCachedJson(
      quoteCacheKey,
      quote.toJSON(),
      PSE_QUOTE_CACHE_TTL_SECONDS,
    );
    return quote;
  }

  static fromSpec(code: string): PseEdgeResolver {
    return new this(code);
  }
}

abstract class BaseYahooQuoteResolver extends BaseHFResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedString?: ResolverServices["getCachedString"];
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  getStoredTextResource?: ResolverServices["getStoredTextResource"];
  putCachedString?: ResolverServices["putCachedString"];
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;
  putStoredTextResource?: ResolverServices["putStoredTextResource"];
  preferredReitTickerSet: ReadonlySet<string> | null;

  constructor(code: string, traceLabel?: string) {
    super(code, traceLabel);
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

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    let yahooSymbol: string;
    let preferredYahooSymbol: string;
    let fxPair: FxRequest["fxPair"] | null;

    if (request instanceof FxRequest) {
      yahooSymbol = request.fxPair.yahooChartSymbol;
      preferredYahooSymbol = "";
      fxPair = request.fxPair;
    } else {
      const eq = request as EquityRequest;
      yahooSymbol = eq.yahooSymbol;
      preferredYahooSymbol = this.buildPreferredYahooSymbol(eq.yahooSymbol);
      fxPair = null;
    }

    const lookupYahooSymbol = preferredYahooSymbol || yahooSymbol;
    const cacheKey = `hoodlefinance:${lookupYahooSymbol}`;
    const cached = this.getCachedJson(cacheKey);
    const cachedQuote = cached ? new StockQuote(cached as never) : null;

    if (cached) {
      return fxPair && cachedQuote ? decorateFxQuote(cachedQuote, fxPair) : cachedQuote;
    }

    const responseItem = fetchRequestsSequentially(this.httpFetch, [
      {
        cacheKey,
        url: buildYahooChartUrl(lookupYahooSymbol),
        yahooSymbol: lookupYahooSymbol,
      },
    ])[0];

    if (responseItem?.error) {
      throw responseItem.error;
    }

    const stockQuote = extractYahooQuoteMetaFromResponse(
      responseItem?.response as TextHttpResponse,
      (request instanceof RawRequestInput || request instanceof RequestInput ? request.identifier : request.input.identifier) || lookupYahooSymbol,
    );
    const quote = fxPair ? decorateFxQuote(stockQuote, fxPair) : stockQuote;
    this.putCachedJson(cacheKey, quote.toJSON(), 60);
    return quote;
  }

}

export class YahooEquityQuoteResolver extends BaseYahooQuoteResolver {
  constructor(code = "YAHOO-QUOTE") {
    super(code, "YAHOO");
  }

  getExampleInput(): string | null {
    return "GOOG";
  }

  getRoutingDescription(): string | null {
    return "Yahoo equity quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      request instanceof EquityRequest &&
      request.exchange !== "PSE" &&
      !isLonIsinAttributeRequest(request) &&
      !!request.yahooSymbol
    );
  }

  getResolverClass(): string {
    return "TICKER";
  }

  static fromSpec(code: string): YahooEquityQuoteResolver {
    return new this(code);
  }
}

export class YahooFxResolver extends BaseYahooQuoteResolver {
  constructor(code = "YAHOO-FX") {
    super(code, "YAHOO");
  }

  getRoutingDescription(): string | null {
    return "Yahoo FX quote lookup";
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      request instanceof FxRequest &&
      !!request.fxPair &&
      !!request.fxPair.yahooChartSymbol
    );
  }

  getResolverClass(): string {
    return "FORCED:YAHOO";
  }

  static fromSpec(code: string): YahooFxResolver {
    return new this(code);
  }
}

export class TradingviewFundResolver extends BaseHFResolver {
  httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  getCachedJson!: NonNullable<ResolverServices["getCachedJson"]>;
  putCachedJson!: NonNullable<ResolverServices["putCachedJson"]>;

  constructor(code = "TRADINGVIEW-FUND") {
    super(code, "TRADINGVIEW");
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
    return (
      request instanceof EquityRequest &&
      !isLonIsinAttributeRequest(request) &&
      request.allowTradingviewFallback
    );
  }

  override execute(
    request: RequestInput | ResolvedRequest,
  ): unknown {
    const fallbackInfo = buildIsraeliFundTradingviewFallbackInfo(
      String((request as EquityRequest).yahooSymbol || ""),
    );
    const cacheKey = `hoodlefinance:tradingview:quote:${fallbackInfo.yahooSymbol}`;
    const primaryCacheKey = `hoodlefinance:${fallbackInfo.yahooSymbol}`;
    const cached = this.getCachedJson(cacheKey);

    if (cached) {
      this.putCachedJson(primaryCacheKey, cached, 60);
      return cached;
    }

    const responseItem = fetchRequestsSequentially(this.httpFetch, [
      {
        expectedSymbol: fallbackInfo.expectedSymbol,
        url: fallbackInfo.url,
        yahooSymbol: fallbackInfo.yahooSymbol,
      },
    ])[0];

    if (responseItem?.error) {
      throw responseItem.error;
    }

    const quote = extractTradingviewFundQuoteFromResponse(
      responseItem?.response as TextHttpResponse,
      fallbackInfo.yahooSymbol,
      fallbackInfo.expectedSymbol,
    );
    this.putCachedJson(cacheKey, quote.toJSON(), 60);
    this.putCachedJson(primaryCacheKey, quote.toJSON(), 60);
    return quote;
  }

  static fromSpec(code: string): TradingviewFundResolver {
    return new this(code);
  }
}

export class EquityAttributeExtractResolver extends Resolver {
  private httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  private getCachedStringFn!: ResolverServices["getCachedString"];
  private putCachedStringFn!: ResolverServices["putCachedString"];
  private runtimeRefs: PlanRuntimeRefs | null = null;

  constructor(code = "EXTRACT:EQUITY") {
    super(code);
  }

  initEnv(services: ResolverServices): void {
    this.httpFetch = services.httpFetch.bind(services);
    this.getCachedStringFn = services.getCachedString.bind(services);
    this.putCachedStringFn = services.putCachedString.bind(services);
  }

  initRuntimeRefs(refs: PlanRuntimeRefs): void {
    this.runtimeRefs = refs;
  }

  resolve(input: unknown): ResolutionResult<unknown> {
    const { quote, attribute, tickerInput } = input as {
      quote: StockQuote | FxQuote;
      attribute: string;
      tickerInput: string;
    };

    let value: unknown;
    if (String(attribute || "").toLowerCase() === "isin") {
      value = resolveIsinAttributeValue(
        quote,
        { tickerInput },
        {
          fetchText: (url) => this.httpFetch(url).getContentText(),
          getCachedString: (key) => this.getCachedStringFn(key),
          looksLikeIsin,
          putCachedString: (key, val, ttl) =>
            this.putCachedStringFn(key, val, ttl ?? 0),
        },
      );
    } else {
      value = extractRawResolvedAttributeValue(quote, attribute);
      value = convertResolvedMoneyValue(
        value,
        quote,
        attribute,
        this.runtimeRefs,
      );
    }

    return createResolutionSuccess({ extractedValue: value }, 0);
  }

  static fromSpec(code: string): EquityAttributeExtractResolver {
    return new this(code);
  }
}

function isLonIsinAttributeRequest(request: unknown): boolean {
  if (!(request instanceof EquityRequest)) {
    return false;
  }

  if (request.exchange !== "LON") {
    return false;
  }

  return String(request.input.attribute || "").toLowerCase() === "isin";
}

export class LonIsinResolver extends Resolver {
  private httpFetch!: NonNullable<ResolverServices["httpFetch"]>;
  private getCachedStringFn!: ResolverServices["getCachedString"];
  private putCachedStringFn!: ResolverServices["putCachedString"];

  constructor(code = "LON-ISIN") {
    super(code);
  }

  initEnv(services: ResolverServices): void {
    this.httpFetch = services.httpFetch.bind(services);
    this.getCachedStringFn = services.getCachedString.bind(services);
    this.putCachedStringFn = services.putCachedString.bind(services);
  }

  canHandle(input: unknown): boolean {
    return isLonIsinAttributeRequest(input);
  }

  getResolverPath(): string {
    return "LSE";
  }

  resolve(input: unknown): ResolutionResult<unknown> {
    const req = input as Record<string, unknown>;
    const inputObj = req.input as Record<string, unknown> | null | undefined;
    const tickerInput = String(inputObj?.identifier || req.ticker || "");
    const quoteSymbol = String(req.symbol || "");

    try {
      const isin = resolveLonIsin(tickerInput, quoteSymbol, {
        fetchText: (url) => this.httpFetch(url).getContentText(),
        getCachedString: (key) => this.getCachedStringFn(key),
        putCachedString: (key, val, ttl) =>
          this.putCachedStringFn(key, val, ttl ?? 0),
      });
      return createResolutionSuccess({ extractedValue: isin }, 0);
    } catch (error) {
      return createResolutionFailure(
        error,
        0,
        (e) => String(e instanceof Error ? e.message : (e ?? "")),
      );
    }
  }

  static fromSpec(code: string): LonIsinResolver {
    return new this(code);
  }
}

export class FxAttributeExtractResolver extends Resolver {
  private runtimeRefs: PlanRuntimeRefs | null = null;

  constructor(code = "EXTRACT:FX") {
    super(code);
  }

  initRuntimeRefs(refs: PlanRuntimeRefs): void {
    this.runtimeRefs = refs;
  }

  resolve(input: unknown): ResolutionResult<unknown> {
    const { quote, attribute } = input as {
      quote: StockQuote | FxQuote;
      attribute: string;
    };

    const rawValue = extractRawResolvedAttributeValue(quote, attribute);
    const value = convertResolvedMoneyValue(
      rawValue,
      quote,
      attribute,
      this.runtimeRefs,
    );
    return createResolutionSuccess({ extractedValue: value }, 0);
  }

  static fromSpec(code: string): FxAttributeExtractResolver {
    return new this(code);
  }
}

// TODO: replace with self-registration pattern so new resolvers don't require
// editing this map. See "Resolver self-registration" in graph-driven-execution.md.
export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  EquityAttributeExtractResolver,
  FirstSuccessReceiver,
  FxAttributeExtractResolver,
  LocalFxResolver,
  LonIsinResolver,
  GoogleFxResolver,
  PSEFramesResolver: PseFramesResolver,
  PSEEdgeResolver: PseEdgeResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
} as const;
