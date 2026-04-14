import { YAHOO_EXCHANGE_BY_META_NAME, extractYahooExchangeFromSymbol, isPrefixlessExchange, resolveExchangeSuffix } from "./exchange-symbols";
import { FxQuote, StockQuote } from "./quote";
import { parseAttributeRequest, stripTickerSourceOverride } from "./request-parsing";

export { parseAttributeRequest };

interface AttributeExtractionContext {
  routeState?: Record<string, unknown> | null;
  tickerInput?: string | null;
}

function normalizeMoney(quote: StockQuote | FxQuote, value: unknown): number {
  const numericValue = Number(value);

  if (value == null || !Number.isFinite(numericValue)) {
    throw new Error("No value is available for this ticker.");
  }

  if (quote instanceof FxQuote && Number.isFinite(quote.fxUnitScale)) {
    return numericValue * quote.fxUnitScale;
  }

  return numericValue;
}

function pickPrice(quote: StockQuote | FxQuote): number {
  const stockQuote = quote as StockQuote;
  const candidates = [
    stockQuote.regularMarketPrice,
    stockQuote.postMarketPrice,
    stockQuote.preMarketPrice,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (candidate != null && Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new Error("No price is available for this ticker.");
}

function previousClose(quote: StockQuote | FxQuote): number {
  const stockQuote = quote as StockQuote;
  const candidates = [
    stockQuote.regularMarketPreviousClose,
    stockQuote.previousClose,
    stockQuote.chartPreviousClose,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (candidate != null && Number.isFinite(numeric)) {
      return numeric;
    }
  }

  throw new Error("No previous close is available for this ticker.");
}

function change(quote: StockQuote | FxQuote): number {
  return pickPrice(quote) - previousClose(quote);
}

function resolveGoogleExchange(quote: StockQuote): string {
  const suffixExchange = extractYahooExchangeFromSymbol(String(quote.symbol || "").trim());
  if (suffixExchange) {
    return YAHOO_EXCHANGE_BY_META_NAME[suffixExchange] || suffixExchange;
  }

  const rawExchange = String(
    quote.exchangeName || quote.fullExchangeName || quote.quoteSourceName || "",
  )
    .trim()
    .toUpperCase();

  if (!rawExchange) {
    return "";
  }

  return YAHOO_EXCHANGE_BY_META_NAME[rawExchange] || rawExchange;
}

function renderGoogleSymbol(quote: StockQuote | FxQuote, resolvedSymbol: string): string {
  if (quote instanceof FxQuote) {
    if (quote.googleSymbol) {
      return String(quote.googleSymbol);
    }

    return "CURRENCY:" + resolvedSymbol.replace(/=X$/i, "");
  }

  const googleExchange = resolveGoogleExchange(quote);
  if (!googleExchange) {
    return resolvedSymbol;
  }

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
  quote: StockQuote | FxQuote,
  context: AttributeExtractionContext | null | undefined,
  style: "google" | "yahoo",
): string {
  const resolvedSymbol = String(quote.symbol || "").trim();

  if (style === "yahoo") {
    if (quote instanceof FxQuote) {
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
  quote: StockQuote | FxQuote,
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
    quote instanceof FxQuote
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
        (quote as StockQuote).longName ||
        quote.shortName ||
        (quote as StockQuote).displayName ||
        quote.symbol ||
        "";
      break;
    case "currency":
      value = quote.currency;
      break;
    case "isin":
      value = (quote as StockQuote).isin || "";
      break;
    case "high":
      value = normalizeMoney(quote, (quote as StockQuote).regularMarketDayHigh);
      break;
    case "low":
      value = normalizeMoney(quote, (quote as StockQuote).regularMarketDayLow);
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
      if ((quote as StockQuote).regularMarketVolume == null) {
        throw new Error("No volume is available for this ticker.");
      }
      value = (quote as StockQuote).regularMarketVolume;
      break;
    case "tradetime": {
      const stockQuote = quote as StockQuote;
      const timestamp =
        stockQuote.regularMarketTime ||
        stockQuote.postMarketTime ||
        stockQuote.preMarketTime;
      const numericTimestamp = Number(timestamp);

      if (timestamp == null || !Number.isFinite(numericTimestamp)) {
        throw new Error("No trade time is available for this ticker.");
      }

      value = new Date(numericTimestamp * 1000);
      break;
    }
    case "datadelay":
      value =
        (quote as StockQuote).exchangeDataDelayedBy != null
          ? (quote as StockQuote).exchangeDataDelayedBy
          : 0;
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
      if (quote instanceof FxQuote) {
        value = "CURRENCY";
        break;
      }

      value = resolveGoogleExchange(quote);
      break;
    }
    case "exchange:yahoo": {
      if (quote instanceof FxQuote) {
        value = "CURRENCY";
        break;
      }

      const stockQuote = quote as StockQuote;
      const suffixExchangeYahoo = extractYahooExchangeFromSymbol(String(stockQuote.symbol || "").trim());
      if (suffixExchangeYahoo) {
        value = suffixExchangeYahoo;
        break;
      }

      value = String(stockQuote.exchangeName || stockQuote.fullExchangeName || stockQuote.quoteSourceName || "")
        .trim()
        .toUpperCase();
      break;
    }
    default:
      throw new Error(`Unsupported attribute "${attribute}".`);
  }

  if (!attributeRequest.wantsOutputCurrency) {
    return value;
  }

  if (baseAttribute === "currency") {
    throw new Error('Attribute "currency" does not support output-currency conversion.');
  }

  if (baseAttribute !== "price") {
    throw new Error(
      `Attribute "${baseAttribute}" does not support output-currency conversion. Supported attribute is: price.`,
    );
  }

  const quoteCurrency = quote.currency;
  const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();

  if (quoteCurrency === targetCurrency) {
    return value;
  }

  throw new Error(
    `Output-currency conversion from "${quoteCurrency}" to "${targetCurrency}" is currently unavailable. No valid FX rate was successfully resolved for this ticker.`,
  );
}
