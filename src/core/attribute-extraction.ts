import {
  extractYahooExchangeFromSymbol,
  isPrefixlessExchange,
  resolveExchangeSuffix,
  resolveGoogleExchange,
} from "./exchange-symbols";
import { FxQuote, StockQuote } from "./quote";
import { parseAttributeRequest } from "./request-parsing";

export { parseAttributeRequest };

export function extractQuoteCurrencyCode(quote: StockQuote | FxQuote): string {
  return String(
    quote.currency || (quote as StockQuote).financialCurrency || "",
  );
}

export function extractQuoteMoneyUnitScale(
  quote: StockQuote | FxQuote,
): number | undefined {
  const explicitUnitScale = Number(quote.fxUnitScale);

  if (Number.isFinite(explicitUnitScale)) {
    return explicitUnitScale;
  }

  return undefined;
}

function normalizeMoney(quote: StockQuote | FxQuote, value: unknown): number {
  const numericValue = Number(value);

  if (value == null || !Number.isFinite(numericValue)) {
    throw new Error("No value is available for this ticker.");
  }

  const unitScale = extractQuoteMoneyUnitScale(quote);

  if (typeof unitScale === "number" && Number.isFinite(unitScale)) {
    return numericValue * unitScale;
  }

  return numericValue;
}

function previousClose(quote: StockQuote | FxQuote): number {
  return normalizeMoney(
    quote,
    (quote as StockQuote).regularMarketPreviousClose,
  );
}

function change(quote: StockQuote | FxQuote): number {
  const price = normalizeMoney(quote, quote.regularMarketPrice);
  return price - previousClose(quote);
}

function renderGoogleSymbol(
  quote: StockQuote | FxQuote,
  resolvedSymbol: string,
): string {
  if (quote instanceof FxQuote) {
    if (quote.googleSymbol) {
      return String(quote.googleSymbol);
    }

    return "CURRENCY:" + resolvedSymbol.replace(/=X$/i, "");
  }

  const googleExchange = resolveGoogleExchange(
    resolvedSymbol,
    String(
      (quote as StockQuote).exchangeName ||
        (quote as StockQuote).fullExchangeName ||
        (quote as StockQuote).quoteSourceName ||
        "",
    ),
  );
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
  style: "google" | "yahoo",
): string {
  const resolvedSymbol = String(quote.symbol || "").trim();

  if (style === "yahoo") {
    if (quote instanceof FxQuote) {
      return resolvedSymbol.replace(/=X$/i, "") + "=X";
    }

    return resolvedSymbol;
  }

  return renderGoogleSymbol(quote, resolvedSymbol);
}

export function extractAttributeValue(
  quote: StockQuote | FxQuote,
  attribute: string,
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
      value = normalizeMoney(quote, quote.regularMarketPrice);
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
      value = String(
        quote.currency || (quote as StockQuote).financialCurrency || "",
      );
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
      value = previousClose(quote);
      break;
    case "change":
      value = change(quote);
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
      const timestamp = stockQuote.regularMarketTime;
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
      value = resolveSymbolAttribute(quote, "google");
      break;
    case "symbol:yahoo":
      value = resolveSymbolAttribute(quote, "yahoo");
      break;
    case "exchange":
    case "exchange:google": {
      if (quote instanceof FxQuote) {
        value = "CURRENCY";
        break;
      }

      const googleStockQuote = quote as StockQuote;
      value = resolveGoogleExchange(
        String(googleStockQuote.symbol || "").trim(),
        String(
          googleStockQuote.exchangeName ||
            googleStockQuote.fullExchangeName ||
            googleStockQuote.quoteSourceName ||
            "",
        ),
      );
      break;
    }
    case "exchange:yahoo": {
      if (quote instanceof FxQuote) {
        value = "CURRENCY";
        break;
      }

      const stockQuote = quote as StockQuote;
      const suffixExchangeYahoo = extractYahooExchangeFromSymbol(
        String(stockQuote.symbol || "").trim(),
      );
      if (suffixExchangeYahoo) {
        value = suffixExchangeYahoo;
        break;
      }

      value = String(
        stockQuote.exchangeName ||
          stockQuote.fullExchangeName ||
          stockQuote.quoteSourceName ||
          "",
      )
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
    throw new Error(
      'Attribute "currency" does not support output-currency conversion.',
    );
  }

  if (baseAttribute !== "price") {
    throw new Error(
      `Attribute "${baseAttribute}" does not support output-currency conversion. Supported attribute is: price.`,
    );
  }

  const quoteCurrency = extractQuoteCurrencyCode(quote);
  const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();

  if (quoteCurrency === targetCurrency) {
    return value;
  }

  throw new Error(
    `Output-currency conversion from "${quoteCurrency}" to "${targetCurrency}" is currently unavailable. No valid FX rate was successfully resolved for this ticker.`,
  );
}
