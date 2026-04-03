import { parseAttributeRequest } from "./request-parsing";
import { stripDefaultTickerSourceOverride } from "./source-overrides";

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

function extractCurrencyValue(quote: Record<string, unknown>): string {
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

function resolveSymbolAttribute(
  quote: Record<string, unknown>,
  context: AttributeExtractionContext | null | undefined,
  style: "google" | "yahoo",
): string {
  const resolvedSymbol = String(quote.symbol || "").trim();

  if (style === "yahoo") {
    return resolvedSymbol;
  }

  const preferredYahooSymbol = String(
    context && context.routeState ? context.routeState.preferredYahooSymbol || "" : "",
  )
    .trim()
    .toUpperCase();
  const tickerInput = stripDefaultTickerSourceOverride(
    String(context && context.tickerInput ? context.tickerInput : ""),
  ).trim();

  if (
    preferredYahooSymbol &&
    tickerInput &&
    resolvedSymbol.toUpperCase() === preferredYahooSymbol
  ) {
    return tickerInput;
  }

  return resolvedSymbol;
}

export function extractAttributeValue(
  quote: Record<string, unknown>,
  attribute: string,
  context?: AttributeExtractionContext,
): unknown {
  const attributeRequest = parseAttributeRequest(attribute);
  const baseAttribute = attributeRequest.baseAttribute;

  if (attributeRequest.wantsOutputCurrency) {
    throw new Error(
      "Output-currency conversion is not yet supported in the TypeScript CLI.",
    );
  }

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
      return normalizeMoney(quote, pickPrice(quote));
    case "name":
      return (
        quote.longName ||
        quote.shortName ||
        quote.displayName ||
        quote.symbol ||
        ""
      );
    case "currency":
      return extractCurrencyValue(quote);
    case "high":
      return normalizeMoney(quote, quote.regularMarketDayHigh);
    case "low":
      return normalizeMoney(quote, quote.regularMarketDayLow);
    case "close":
      return normalizeMoney(quote, previousClose(quote));
    case "change":
      return normalizeMoney(quote, change(quote));
    case "changepct":
      return change(quote) / previousClose(quote);
    case "volume":
      if (quote.regularMarketVolume == null) {
        throw new Error("No volume is available for this ticker.");
      }
      return quote.regularMarketVolume;
    case "tradetime": {
      const timestamp =
        quote.regularMarketTime || quote.postMarketTime || quote.preMarketTime;
      const numericTimestamp = Number(timestamp);

      if (timestamp == null || !Number.isFinite(numericTimestamp)) {
        throw new Error("No trade time is available for this ticker.");
      }

      return new Date(numericTimestamp * 1000);
    }
    case "datadelay":
      return quote.exchangeDataDelayedBy != null ? quote.exchangeDataDelayedBy : 0;
    case "symbol":
    case "symbol:google":
      return resolveSymbolAttribute(quote, context, "google");
    case "symbol:yahoo":
      return resolveSymbolAttribute(quote, context, "yahoo");
    case "exchange":
    case "exchange:google":
    case "exchange:yahoo":
      return quote.fullExchangeName || quote.exchangeName || "";
    default:
      throw new Error(`Unsupported attribute "${attribute}".`);
  }
}
