import type { TextHttpResponse } from "./text-http-response";
import { StockQuote } from "./quote";

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
    currency: meta.currency != null ? String(meta.currency) : undefined,
    displayName: meta.displayName != null ? String(meta.displayName) : undefined,
    exchangeDataDelayedBy:
      meta.exchangeDataDelayedBy != null ? Number(meta.exchangeDataDelayedBy) : undefined,
    exchangeName: meta.exchangeName != null ? String(meta.exchangeName) : undefined,
    financialCurrency:
      meta.financialCurrency != null ? String(meta.financialCurrency) : undefined,
    fullExchangeName:
      meta.fullExchangeName != null ? String(meta.fullExchangeName) : undefined,
    isin: meta.isin != null ? String(meta.isin) : undefined,
    longName: meta.longName != null ? String(meta.longName) : undefined,
    postMarketPrice:
      meta.postMarketPrice != null ? Number(meta.postMarketPrice) : undefined,
    postMarketTime:
      meta.postMarketTime != null ? Number(meta.postMarketTime) : undefined,
    preMarketPrice:
      meta.preMarketPrice != null ? Number(meta.preMarketPrice) : undefined,
    preMarketTime:
      meta.preMarketTime != null ? Number(meta.preMarketTime) : undefined,
    previousClose:
      meta.previousClose != null ? Number(meta.previousClose) : undefined,
    quoteSourceName:
      meta.quoteSourceName != null ? String(meta.quoteSourceName) : undefined,
    regularMarketDayHigh:
      meta.regularMarketDayHigh != null ? Number(meta.regularMarketDayHigh) : undefined,
    regularMarketDayLow:
      meta.regularMarketDayLow != null ? Number(meta.regularMarketDayLow) : undefined,
    regularMarketOpen:
      meta.regularMarketOpen != null ? Number(meta.regularMarketOpen) : undefined,
    regularMarketPreviousClose:
      meta.regularMarketPreviousClose != null
        ? Number(meta.regularMarketPreviousClose)
        : undefined,
    regularMarketPrice:
      meta.regularMarketPrice != null ? Number(meta.regularMarketPrice) : undefined,
    regularMarketTime:
      meta.regularMarketTime != null ? Number(meta.regularMarketTime) : undefined,
    regularMarketVolume:
      meta.regularMarketVolume != null ? Number(meta.regularMarketVolume) : undefined,
    shortName: meta.shortName != null ? String(meta.shortName) : undefined,
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
