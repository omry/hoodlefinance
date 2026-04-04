import {
  extractTickerExchange,
  extractYahooExchangeFromSymbol,
  normalizeIsraeliFundCode,
  YAHOO_EXCHANGE_BY_META_NAME,
} from "./exchange-symbols";
import {
  buildTradingviewIsinLookupUrl,
  extractTradingviewIsinFromHtml,
  resolveLonIsin,
  resolveLonIsinByTickerInput,
  resolvePseIsinBySymbol,
} from "./isin-sources";

const TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE: Record<string, string> = {
  AMEX: "AMEX",
  AMS: "EURONEXT",
  ASX: "ASX",
  BIT: "MIL",
  BMV: "BMV",
  BOM: "BSE",
  BSE: "BSE",
  BVMF: "BMFBOVESPA",
  BRU: "EURONEXT",
  CPH: "OMXCOP",
  EPA: "EURONEXT",
  ETR: "XETR",
  FRA: "FWB",
  HEL: "OMXHEX",
  HKG: "HKEX",
  IST: "BIST",
  JSE: "JSE",
  KRX: "KRX",
  LON: "LSE",
  MAD: "BME",
  NASDAQ: "NASDAQ",
  NEO: "NEO",
  NSE: "NSE",
  NYSE: "NYSE",
  NYSEAMERICAN: "AMEX",
  NYSEARCA: "AMEX",
  NZE: "NZX",
  OSL: "OSL",
  OTCMKTS: "OTC",
  PAR: "EURONEXT",
  SGX: "SGX",
  SHA: "SSE",
  SHE: "SZSE",
  SIX: "SIX",
  STO: "OMXSTO",
  SWX: "SIX",
  TASE: "TASE",
  TLV: "TASE",
  TPE: "TWSE",
  TSE: "TSX",
  TSX: "TSX",
  TYO: "TSE",
  WSE: "GPW",
};

const ISIN_SOURCE_BY_EXCHANGE: Record<string, string> = {
  AMEX: "TRADINGVIEW",
  AMS: "TRADINGVIEW",
  ASX: "TRADINGVIEW",
  BIT: "TRADINGVIEW",
  BMV: "TRADINGVIEW",
  BOM: "TRADINGVIEW",
  BSE: "TRADINGVIEW",
  BVMF: "TRADINGVIEW",
  BRU: "TRADINGVIEW",
  CPH: "TRADINGVIEW",
  EPA: "TRADINGVIEW",
  ETR: "TRADINGVIEW",
  FRA: "TRADINGVIEW",
  HEL: "TRADINGVIEW",
  HKG: "TRADINGVIEW",
  IST: "TRADINGVIEW",
  JSE: "TRADINGVIEW",
  KRX: "TRADINGVIEW",
  LON: "LON",
  MAD: "TRADINGVIEW",
  NASDAQ: "TRADINGVIEW",
  NEO: "TRADINGVIEW",
  NSE: "TRADINGVIEW",
  NYSE: "TRADINGVIEW",
  NYSEAMERICAN: "TRADINGVIEW",
  NYSEARCA: "TRADINGVIEW",
  NZE: "TRADINGVIEW",
  OSL: "TRADINGVIEW",
  OTCMKTS: "TRADINGVIEW",
  PAR: "TRADINGVIEW",
  PSE: "PSE",
  SGX: "TRADINGVIEW",
  SHA: "TRADINGVIEW",
  SHE: "TRADINGVIEW",
  SIX: "TRADINGVIEW",
  STO: "TRADINGVIEW",
  SWX: "TRADINGVIEW",
  TASE: "TRADINGVIEW",
  TLV: "TRADINGVIEW",
  TPE: "TRADINGVIEW",
  TSE: "TRADINGVIEW",
  TSX: "TRADINGVIEW",
  TYO: "TRADINGVIEW",
  WSE: "TRADINGVIEW",
};

export interface ResolveIsinAttributeDependencies {
  fetchText(url: string): string;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
}

export interface ResolveIsinAttributeContext {
  sourceOverride?: string;
  tickerInput?: string;
}

export interface DirectIsinAttributeResolution {
  route: string;
  value: string;
}

function extractQuoteSymbol(quote: Record<string, unknown>): string {
  return String(quote.symbol || "").trim().toUpperCase();
}

function extractYahooExchangeFromQuote(quote: Record<string, unknown>): string {
  const exchangeName = String(
    quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName || "",
  )
    .trim()
    .toUpperCase();

  return exchangeName ? YAHOO_EXCHANGE_BY_META_NAME[exchangeName] || "" : "";
}

function isFxContext(quote: Record<string, unknown>): boolean {
  return Boolean(
    quote.hoodlefinanceFxDisplayCurrency != null ||
      quote.hoodlefinanceFxGoogleSymbol != null ||
      /^[A-Z]{6}(=X)?$/.test(extractQuoteSymbol(quote)),
  );
}

export function extractDirectIsinInput(
  tickerInput: string,
  looksLikeIsin: (value: string) => boolean,
): string {
  const value = String(tickerInput || "").trim().toUpperCase();
  const isin = value.startsWith("ISIN:") ? value.slice(5).trim() : value;

  return looksLikeIsin(isin) ? isin : "";
}

export function inferIsinExchange(
  quote: Record<string, unknown>,
  tickerInput: string,
): string {
  const normalizedTickerInput = String(tickerInput || "").trim().toUpperCase();
  const explicitExchange = extractTickerExchange(normalizedTickerInput);
  const resolvedSymbol = extractQuoteSymbol(quote);
  const suffixExchange = extractYahooExchangeFromSymbol(
    resolvedSymbol || normalizedTickerInput,
  );
  const metaExchange = extractYahooExchangeFromQuote(quote);

  if (normalizedTickerInput.startsWith("PSE:")) {
    return "PSE";
  }

  if (explicitExchange) {
    return explicitExchange;
  }

  if (suffixExchange) {
    return suffixExchange;
  }

  if (metaExchange) {
    return metaExchange;
  }

  return "";
}

export function inferTradingviewExchange(
  quote: Record<string, unknown>,
  tickerInput: string,
): string {
  const yahooExchange = inferIsinExchange(quote, tickerInput);
  return yahooExchange
    ? TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE[yahooExchange] || ""
    : "";
}

export function extractTradingviewCode(
  quote: Record<string, unknown>,
  tickerInput: string,
): string {
  const candidates = [
    String(tickerInput || "").trim().toUpperCase(),
    extractQuoteSymbol(quote),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.includes(":")) {
      const parts = candidate.split(":");
      const exchange = String(parts[0] || "").trim().toUpperCase();
      const code = parts.slice(1).join(":").trim().toUpperCase();

      if (
        exchange === "TLV" ||
        exchange === "TASE" ||
        /\.TA$/i.test(code)
      ) {
        return normalizeIsraeliFundCode(code.replace(/\.TA$/i, ""));
      }

      return code;
    }

    const suffixMatch = candidate.match(/^(.+)\.[A-Z0-9]+$/);
    if (suffixMatch) {
      const code = String(suffixMatch[1] || "").trim().toUpperCase();
      return /\.TA$/i.test(candidate)
        ? normalizeIsraeliFundCode(code)
        : code;
    }

    return candidate;
  }

  return "";
}

export function resolveIsinAttributeValue(
  quote: Record<string, unknown>,
  context: ResolveIsinAttributeContext,
  deps: ResolveIsinAttributeDependencies,
): string {
  const tickerInput = String(context.tickerInput || "").trim();
  const sourceOverride = String(context.sourceOverride || "")
    .trim()
    .toUpperCase();
  const directIsinInput = extractDirectIsinInput(tickerInput, deps.looksLikeIsin);
  const exchange = inferIsinExchange(quote, tickerInput);
  const source =
    sourceOverride || (exchange ? ISIN_SOURCE_BY_EXCHANGE[exchange] || "" : "");

  if (directIsinInput) {
    return directIsinInput;
  }

  if (isFxContext(quote)) {
    throw new Error("ISIN is not available for currency pairs.");
  }

  if (!source) {
    if (!exchange) {
      throw new Error(
        'Could not determine which market to use for ISIN lookup. Try an identifier source override such as "@TRADINGVIEW", "@LON", "@PSE", "@ARIVA", or "@IBKR".',
      );
    }

    throw new Error(
      `ISIN lookup is not supported yet for exchange "${exchange}". Try an identifier source override such as "@TRADINGVIEW", "@LON", "@PSE", "@ARIVA", or "@IBKR".`,
    );
  }

  if (
    sourceOverride &&
    !["ARIVA", "IBKR", "LON", "PSE", "TRADINGVIEW"].includes(sourceOverride)
  ) {
    throw new Error(`"@${sourceOverride}" is not available for ISIN lookups.`);
  }

  if (source === "PSE") {
    if (quote.isin) {
      return String(quote.isin).trim().toUpperCase();
    }

    throw new Error("No PSE ISIN is available for this ticker.");
  }

  if (source === "LON") {
    return resolveLonIsin(tickerInput, extractQuoteSymbol(quote), {
      fetchText: deps.fetchText,
      getCachedString: deps.getCachedString,
      putCachedString: deps.putCachedString,
    });
  }

  if (source === "TRADINGVIEW") {
    const tradingviewExchange = inferTradingviewExchange(quote, tickerInput);
    const code = extractTradingviewCode(quote, tickerInput);
    const cacheKey = `hoodlefinance:tradingview:isin:${tradingviewExchange}:${code}`;
    const expectedSymbol =
      tradingviewExchange && code ? `${tradingviewExchange}:${code}` : "";
    const displaySymbol = tickerInput || expectedSymbol;
    const cached = deps.getCachedString(cacheKey);

    if (!tradingviewExchange) {
      if (exchange) {
        throw new Error(
          `TradingView cannot be used for ISIN lookup on exchange "${exchange}".`,
        );
      }

      throw new Error(
        "Could not determine which market to use for TradingView ISIN lookup.",
      );
    }

    if (!code) {
      throw new Error(
        "Could not determine the ticker code needed for TradingView ISIN lookup.",
      );
    }

    if (cached) {
      return cached;
    }

    const isin = extractTradingviewIsinFromHtml(
      deps.fetchText(buildTradingviewIsinLookupUrl(tradingviewExchange, code)),
      expectedSymbol,
      displaySymbol,
    );

    deps.putCachedString(cacheKey, isin, 21600);
    return isin;
  }

  throw new Error(
    `${source} ISIN lookup is not yet supported in the TypeScript CLI.`,
  );
}

export function resolveDirectIsinAttributeValue(
  context: ResolveIsinAttributeContext,
  deps: ResolveIsinAttributeDependencies,
): DirectIsinAttributeResolution | null {
  const tickerInput = String(context.tickerInput || "").trim();
  const directIsinInput = extractDirectIsinInput(tickerInput, deps.looksLikeIsin);

  if (directIsinInput) {
    return {
      route: "ATTRIBUTE-IDENTITY",
      value: directIsinInput,
    };
  }

  const normalizedTicker = tickerInput.toUpperCase();

  if (normalizedTicker.startsWith("PSE:")) {
    return {
      route: "PSE",
      value: resolvePseIsinBySymbol(
        normalizedTicker.slice(4).trim().toUpperCase(),
        deps.fetchText,
      ),
    };
  }

  if (normalizedTicker.startsWith("LON:") || normalizedTicker.endsWith(".L")) {
    return {
      route: "LON",
      value: resolveLonIsinByTickerInput(tickerInput, {
        fetchText: deps.fetchText,
        getCachedString: deps.getCachedString,
        putCachedString: deps.putCachedString,
      }),
    };
  }

  return null;
}
