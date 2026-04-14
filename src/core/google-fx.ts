import type { FxPair } from "./request";
import type { TextHttpResponse } from "./text-http-response";

export function buildGoogleFinanceQuoteUrl(pairSlug: string): string {
  return `https://www.google.com/finance/quote/${encodeURIComponent(
    pairSlug,
  )}`;
}

function findGoogleFinancePairTuple(
  value: unknown,
  pairSlug: string,
): unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.indexOf(pairSlug) >= 0) {
    return value;
  }

  for (const entry of value) {
    const nested = findGoogleFinancePairTuple(entry, pairSlug);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractGoogleFinancePairTuple(
  response: TextHttpResponse,
  pairSlug: string,
): unknown[] {
  const html = response.getContentText();
  const callbacks =
    String(html || "").match(
      /AF_initDataCallback\(([\s\S]*?)\);\s*<\/script>/gi,
    ) || [];

  for (const callback of callbacks) {
    const dataMatch = callback.match(/data:(\[[\s\S]*?\]),\s*sideChannel:/i);

    if (!dataMatch) {
      continue;
    }

    const tuple = findGoogleFinancePairTuple(
      JSON.parse(dataMatch[1] || "[]"),
      pairSlug,
    );
    if (tuple) {
      return tuple;
    }
  }

  throw new Error(
    `Google Finance did not expose a quote tuple for "${pairSlug}".`,
  );
}

export function extractGoogleFinanceFxPairQuote(
  response: TextHttpResponse,
  fxPair: FxPair,
): Record<string, unknown> {
  const pairSlug = String(fxPair.googlePairSlug || "")
    .trim()
    .toUpperCase();
  const tuple = extractGoogleFinancePairTuple(response, pairSlug);
  const marketData = Array.isArray(tuple[5]) ? tuple[5] : [];
  const pairDetail = Array.isArray(tuple[15]) ? tuple[15] : [];
  const currentPrice = Number(marketData[0]);
  const changeAmount = Number(marketData[1]);
  const previousClose = Number(tuple[7]);
  const timestampList = Array.isArray(tuple[11]) ? tuple[11] : [];
  const regularMarketTime = Number(timestampList[0]);
  const baseCode = String(pairDetail[0] || fxPair.baseCanonicalCode)
    .trim()
    .toUpperCase();
  const quoteCode = String(pairDetail[1] || fxPair.quoteCanonicalCode)
    .trim()
    .toUpperCase();
  const baseName = String(pairDetail[2] || baseCode).trim();

  if (!Number.isFinite(currentPrice)) {
    throw new Error(
      `Google Finance did not expose a price for "${pairSlug}".`,
    );
  }

  return {
    currency: quoteCode,
    exchangeDataDelayedBy: 0,
    financialCurrency: quoteCode,
    previousClose: Number.isFinite(previousClose)
      ? previousClose
      : currentPrice - (Number.isFinite(changeAmount) ? changeAmount : 0),
    regularMarketPreviousClose: Number.isFinite(previousClose)
      ? previousClose
      : currentPrice - (Number.isFinite(changeAmount) ? changeAmount : 0),
    regularMarketPrice: currentPrice,
    regularMarketTime: Number.isFinite(regularMarketTime)
      ? regularMarketTime
      : Math.floor(Date.now() / 1000),
    shortName:
      `${baseName} (${fxPair.baseDisplayCode} / ${fxPair.displayQuoteCode})`,
    symbol: `${baseCode}${quoteCode}`,
  };
}
