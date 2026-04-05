import type { FxPair } from "./request";

function resolveFxPairMetadata(fxPair: FxPair): {
  canonicalPair: string;
  displayQuoteCode: string;
  googleSymbol: string;
  pairDisplay: string;
  scale: number;
} {
  const baseCode = String(fxPair.baseCanonicalCode || "")
    .trim()
    .toUpperCase();
  const quoteCode = String(fxPair.quoteCanonicalCode || "")
    .trim()
    .toUpperCase();
  const canonicalPair =
    String(fxPair.canonicalPair || "")
      .trim()
      .toUpperCase() || `${baseCode}${quoteCode}`;
  const displayQuoteCode =
    String(fxPair.displayQuoteCode || fxPair.quoteDisplayCode || "")
      .trim()
      .toUpperCase() || quoteCode;
  const pairDisplay =
    String(fxPair.pairDisplay || "")
      .trim()
      .toUpperCase() || `${baseCode}${displayQuoteCode}`;
  const scale =
    fxPair.scale != null && Number.isFinite(fxPair.scale) ? fxPair.scale : 1;
  const googleSymbol =
    String(fxPair.googleSymbol || "")
      .trim()
      .toUpperCase() ||
    (baseCode.length === 3 && displayQuoteCode.length === 3
      ? `CURRENCY:${baseCode}${displayQuoteCode}`
      : `CURRENCY:${baseCode}.${displayQuoteCode}`);

  return {
    canonicalPair,
    displayQuoteCode,
    googleSymbol,
    pairDisplay,
    scale,
  };
}

export function isSameCurrencyFxPair(fxPair: FxPair | null | undefined): boolean {
  if (!fxPair) {
    return false;
  }

  if (typeof fxPair.isSameCurrency === "boolean") {
    return fxPair.isSameCurrency;
  }

  return (
    String(fxPair.baseCanonicalCode || "")
      .trim()
      .toUpperCase() ===
    String(fxPair.quoteCanonicalCode || "")
      .trim()
      .toUpperCase()
  );
}

export function buildSameCurrencyQuote(fxPair: FxPair): Record<string, unknown> {
  const quoteCurrency = String(fxPair.quoteCanonicalCode || "")
    .trim()
    .toUpperCase();
  const metadata = resolveFxPairMetadata(fxPair);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    currency: quoteCurrency,
    exchangeDataDelayedBy: 0,
    financialCurrency: quoteCurrency,
    hoodlefinanceFxDisplayCurrency: metadata.displayQuoteCode,
    hoodlefinanceFxGoogleSymbol: metadata.googleSymbol,
    hoodlefinanceFxUnitScale: metadata.scale,
    previousClose: 1,
    regularMarketDayHigh: 1,
    regularMarketDayLow: 1,
    regularMarketPreviousClose: 1,
    regularMarketPrice: 1,
    regularMarketTime: nowSeconds,
    shortName: metadata.pairDisplay,
    symbol: metadata.canonicalPair,
  };
}

export function decorateFxQuote(
  quote: Record<string, unknown>,
  fxPair: FxPair | null | undefined,
): Record<string, unknown> {
  if (!fxPair) {
    return quote;
  }

  const metadata = resolveFxPairMetadata(fxPair);
  return {
    ...quote,
    hoodlefinanceFxDisplayCurrency: metadata.displayQuoteCode,
    hoodlefinanceFxGoogleSymbol: metadata.googleSymbol,
    hoodlefinanceFxUnitScale: metadata.scale,
    shortName: metadata.pairDisplay,
    symbol: metadata.canonicalPair,
  };
}

export function extractRawQuote(
  quote: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (
    !quote ||
    (quote.hoodlefinanceFxDisplayCurrency == null &&
      quote.hoodlefinanceFxGoogleSymbol == null &&
      quote.hoodlefinanceFxUnitScale == null)
  ) {
    return quote;
  }

  const rawQuote = { ...quote };
  delete rawQuote.hoodlefinanceFxDisplayCurrency;
  delete rawQuote.hoodlefinanceFxGoogleSymbol;
  delete rawQuote.hoodlefinanceFxUnitScale;
  return rawQuote;
}
