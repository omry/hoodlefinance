export function resolvePseTickerFromLookupMap(
  isin: string,
  tickerByIsin: Record<string, string | undefined>,
): string {
  const normalizedIsin = String(isin || "")
    .trim()
    .toUpperCase();

  if (!normalizedIsin.startsWith("PH")) {
    return "";
  }

  return String(tickerByIsin[normalizedIsin] || "").trim();
}
