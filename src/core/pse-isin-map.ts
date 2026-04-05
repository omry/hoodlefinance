export type PseTickerByIsin = Record<string, string | undefined>;

export function resolvePseTickerFromLookupMap(
  isin: string,
  tickerByIsin: PseTickerByIsin,
): string {
  const normalizedIsin = String(isin || "")
    .trim()
    .toUpperCase();

  if (!normalizedIsin.startsWith("PH")) {
    return "";
  }

  return String(tickerByIsin[normalizedIsin] || "").trim();
}
