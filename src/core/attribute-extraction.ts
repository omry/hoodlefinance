import { parseAttributeRequest } from "./request-parsing";
export { parseAttributeRequest };
import { stripTickerSourceOverride } from "./request-parsing";
import { YAHOO_EXCHANGE_BY_META_NAME, isPrefixlessExchange, resolveExchangeSuffix, extractYahooExchangeFromSymbol } from "./exchange-symbols";

interface AttributeExtractionContext {
  routeState?: Record<string, unknown> | null;
  tickerInput?: string | null;
}

function normalizeCurrency(currency: unknown): string {
  return currency === "GBp"
    ? "GBP"
    : currency === "ILA"
      ? "ILS"
      : String(currency || "");
}

function normalizeMoney(
  quote: Record<string, unknown>,
  value: unknown,
): number {
  const rawCurrency = quote.currency || quote.financialCurrency || "";
  const normalizedCurrency = normalizeCurrency(rawCurrency);
  const fxScale =
    quote.hoodlefinanceFxUnitScale != null
      ? Number(quote.hoodlefinanceFxUnitScale)
      : null;
  const numericValue = Number(value);

  if (value == null || !Number.isFinite(numericValue)) {
    throw new Error("No value is available for this ticker.");
  }

  if (fxScale != null && Number.isFinite(fxScale)) {
    return numericValue * fxScale;
  }

  return (normalizedCurrency === "GBP" &&
    (quote.currency === "GBp" || quote.financialCurrency === "GBp")) ||
    (normalizedCurrency === "ILS" &&
      (quote.currency === "ILA" || quote.financialCurrency === "ILA"))
    ? numericValue / 100
    : numericValue;
}

function pickPrice(quote: Record<string, unknown>): number {
  const candidates = [
    quote.regularMarketPrice,
    quote.postMarketPrice,
    quote.preMarketPrice,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (candidate != null && Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new Error("No price is available for this ticker.");
}

function previousClose(quote: Record<string, unknown>): number {
  const candidates = [
    quote.regularMarketPreviousClose,
    quote.previousClose,
    quote.chartPreviousClose,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (candidate != null && Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new Error("No previous close is available for this ticker.");
}

function change(quote: Record<string, unknown>): number {
  return pickPrice(quote) - previousClose(quote);
}

export function extractCurrencyValue(quote: Record<string, unknown>): string {
  if (quote.hoodlefinanceFxDisplayCurrency != null) {
    return String(quote.hoodlefinanceFxDisplayCurrency);
  }

  return normalizeCurrency(quote.currency || quote.financialCurrency || "");
}

function isFxContext(quote: Record<string, unknown>): boolean {
  return Boolean(
    quote.hoodlefinanceFxDisplayCurrency != null ||
      quote.hoodlefinanceFxGoogleSymbol ||
      /^[A-Z]{6}(=X)?$/.test(String(quote.symbol || "").trim().toUpperCase()),
  );
}

function resolveGoogleExchange(quote: Record<string, unknown>): string {
  const suffixExchange = extractYahooExchangeFromSymbol(String(quote.symbol || "").trim());
  if (suffixExchange) return YAHOO_EXCHANGE_BY_META_NAME[suffixExchange] || suffixExchange;
  const rawExchange = String(
    quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName || "",
  ).trim().toUpperCase();
  if (!rawExchange) return "";
  return YAHOO_EXCHANGE_BY_META_NAME[rawExchange] || rawExchange;
}

function renderGoogleSymbol(quote: Record<string, unknown>, resolvedSymbol: string): string {
  if (isFxContext(quote)) {
    if (quote.hoodlefinanceFxGoogleSymbol) return String(quote.hoodlefinanceFxGoogleSymbol);
    return "CURRENCY:" + resolvedSymbol.replace(/=X$/i, "");
  }

  const googleExchange = resolveGoogleExchange(quote);
  if (!googleExchange) return resolvedSymbol;

  if (isPrefixlessExchange(googleExchange)) {
    return `${googleExchange}:${resolvedSymbol}`;
  }

  const suffix = resolveExchangeSuffix(googleExchange);
  if (suffix && resolvedSymbol.toUpperCase().endsWith(suffix.toUpperCase())) {
    return `${googleExchange}:${resolvedSymbol.slice(0, -suffix.length)}`;
  }

  return resolvedSymbol;
}

function resolveSymbolAttribute(
  quote: Record<string, unknown>,
  context: AttributeExtractionContext | null | undefined,
  style: "google" | "yahoo",
): string {
  const resolvedSymbol = String(quote.symbol || "").trim();

  if (style === "yahoo") {
    if (isFxContext(quote)) {
      return resolvedSymbol.replace(/=X$/i, "") + "=X";
    }
    return resolvedSymbol;
  }

  const preferredYahooSymbol = String(
    context && context.routeState ? context.routeState.preferredYahooSymbol || "" : "",
  )
    .trim()
    .toUpperCase();
  const tickerInput = stripTickerSourceOverride(
    String(context && context.tickerInput ? context.tickerInput : ""),
  ).trim();

  if (
    preferredYahooSymbol &&
    tickerInput &&
    resolvedSymbol.toUpperCase() === preferredYahooSymbol
  ) {
    return tickerInput;
  }

  return renderGoogleSymbol(quote, resolvedSymbol);
}

export function extractAttributeValue(
  quote: Record<string, unknown>,
  attribute: string,
  context?: AttributeExtractionContext,
): unknown {
  const attributeRequest = parseAttributeRequest(attribute);
  const baseAttribute = attributeRequest.baseAttribute;
 
  let value: unknown;
 
  if (
    (baseAttribute === "high" ||
      baseAttribute === "low" ||
      baseAttribute === "volume") &&
    isFxContext(quote)
  ) {
    throw new Error(
      `Attribute "${baseAttribute}" is not available for currency-pair identifiers.`,
    );
  }
 
  switch (baseAttribute) {
    case "price":
      value = normalizeMoney(quote, pickPrice(quote));
      break;
    case "name":
      value =
        quote.longName ||
        quote.shortName ||
        quote.displayName ||
        quote.symbol ||
        "";
      break;
    case "currency":
      value = extractCurrencyValue(quote);
      break;
    case "isin":
      value = quote.isin || "";
      break;
    case "high":
      value = normalizeMoney(quote, quote.regularMarketDayHigh);
      break;
    case "low":
      value = normalizeMoney(quote, quote.regularMarketDayLow);
      break;
    case "close":
      value = normalizeMoney(quote, previousClose(quote));
      break;
    case "change":
      value = normalizeMoney(quote, change(quote));
      break;
    case "changepct":
      value = change(quote) / previousClose(quote);
      break;
    case "volume":
      if (quote.regularMarketVolume == null) {
        throw new Error("No volume is available for this ticker.");
      }
      value = quote.regularMarketVolume;
      break;
    case "tradetime": {
      const timestamp =
        quote.regularMarketTime || quote.postMarketTime || quote.preMarketTime;
      const numericTimestamp = Number(timestamp);
 
      if (timestamp == null || !Number.isFinite(numericTimestamp)) {
        throw new Error("No trade time is available for this ticker.");
      }
 
      value = new Date(numericTimestamp * 1000);
      break;
    }
    case "datadelay":
      value = quote.exchangeDataDelayedBy != null ? quote.exchangeDataDelayedBy : 0;
      break;
    case "symbol":
    case "symbol:google":
      value = resolveSymbolAttribute(quote, context, "google");
      break;
    case "symbol:yahoo":
      value = resolveSymbolAttribute(quote, context, "yahoo");
      break;
    case "exchange":
    case "exchange:google": {
      if (isFxContext(quote)) {
        value = "CURRENCY";
        break;
      }
      value = resolveGoogleExchange(quote);
      break;
    }
    case "exchange:yahoo": {
      if (isFxContext(quote)) {
        value = "CURRENCY";
        break;
      }
      const suffixExchangeYahoo = extractYahooExchangeFromSymbol(String(quote.symbol || "").trim());
      if (suffixExchangeYahoo) {
        value = suffixExchangeYahoo;
        break;
      }
      value = String(
        quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName || "",
      ).trim().toUpperCase();
      break;
    }
    default:
      throw new Error(`Unsupported attribute "${attribute}".`);
  }
 
  if (!attributeRequest.wantsOutputCurrency) {
    return value;
  }
 
  if (baseAttribute === "currency") {
    throw new Error(
      'Attribute "currency" does not support output-currency conversion.',
    );
  }
 
  if (baseAttribute !== "price") {
    throw new Error(
      `Attribute "${baseAttribute}" does not support output-currency conversion. Supported attribute is: price.`,
    );
  }
 
  const quoteCurrency = extractCurrencyValue(quote);
  const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();
 
  if (quoteCurrency === targetCurrency) {
    return value;
  }
 
  const fxScale = quote.hoodlefinanceFxUnitScale != null ? Number(quote.hoodlefinanceFxUnitScale) : null;
  const isCorrectScale = fxScale != null && Number.isFinite(fxScale);
 
  if (isCorrectScale) {
    return value;
  }
 
  throw new Error(
    `Output-currency conversion from "${quoteCurrency}" to "${targetCurrency}" is currently unavailable. No valid FX rate was successfully resolved for this ticker.`,
  );
}
