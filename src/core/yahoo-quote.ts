import type { TextHttpResponse } from "./text-http-response";
import { StockQuote } from "./quote";

function str(value: unknown): string | undefined {
  return value != null ? String(value) : undefined;
}

function num(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function pickFiniteNumber(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = num(v);
    if (n !== undefined) return n;
  }
  return undefined;
}

export function buildYahooChartUrl(yahooSymbol: string): string {
  return (
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(String(yahooSymbol || "").trim()) +
    "?interval=1d&range=1d"
  );
}

export function buildYahooQuoteLookupErrorMessage(
  ticker: string,
  statusCode: number,
): string {
  const normalizedTicker = String(ticker || "").trim();
  const upperTicker = normalizedTicker.toUpperCase();

  if (Number(statusCode) === 404 && upperTicker.indexOf("OTCMKTS:") === 0) {
    return (
      "No current quote data was found for " +
      normalizedTicker +
      ". The symbol may be delisted or cancelled."
    );
  }

  return (
    "Quote lookup failed for " + normalizedTicker + " (" + statusCode + ")."
  );
}

export function extractYahooQuoteMetaFromPayload(
  payload: Record<string, unknown> | null | undefined,
  ticker: string,
): StockQuote {
  const chart = payload && payload.chart;
  const results =
    chart && typeof chart === "object" && "result" in chart
      ? (chart.result as unknown[])
      : null;
  const firstResult = Array.isArray(results) ? results[0] : null;
  const meta =
    firstResult && typeof firstResult === "object" && "meta" in firstResult
      ? (firstResult.meta as Record<string, unknown> | null | undefined)
      : null;

  if (!meta) {
    throw new Error("No quote data was found for " + ticker + ".");
  }

  return new StockQuote({
    currency: str(meta.currency),
    displayName: str(meta.displayName),
    exchangeDataDelayedBy: num(meta.exchangeDataDelayedBy),
    exchangeName: str(meta.exchangeName),
    financialCurrency: str(meta.financialCurrency),
    fullExchangeName: str(meta.fullExchangeName),
    isin: str(meta.isin),
    longName: str(meta.longName),
    quoteSourceName: str(meta.quoteSourceName),
    regularMarketDayHigh: num(meta.regularMarketDayHigh),
    regularMarketDayLow: num(meta.regularMarketDayLow),
    regularMarketPreviousClose: pickFiniteNumber(
      meta.regularMarketPreviousClose,
      meta.previousClose,
      meta.chartPreviousClose,
    ),
    regularMarketPrice: pickFiniteNumber(
      meta.regularMarketPrice,
      meta.postMarketPrice,
      meta.preMarketPrice,
    ),
    regularMarketTime: pickFiniteNumber(
      meta.regularMarketTime,
      meta.postMarketTime,
      meta.preMarketTime,
    ),
    regularMarketVolume: num(meta.regularMarketVolume),
    shortName: str(meta.shortName),
    symbol: String(meta.symbol || ticker),
  });
}

export function extractYahooQuoteMetaFromResponse(
  response: TextHttpResponse,
  ticker: string,
): StockQuote {
  if (response.getResponseCode() !== 200) {
    throw new Error(
      buildYahooQuoteLookupErrorMessage(ticker, response.getResponseCode()),
    );
  }

  return extractYahooQuoteMetaFromPayload(
    JSON.parse(response.getContentText()),
    ticker,
  );
}
