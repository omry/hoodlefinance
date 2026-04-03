export interface YahooQuoteResponseLike {
  getContentText(): string;
  getResponseCode(): number;
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
): Record<string, unknown> {
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

  return meta;
}

export function extractYahooQuoteMetaFromResponse(
  response: YahooQuoteResponseLike,
  ticker: string,
): Record<string, unknown> {
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
