import type { FxPair } from "./request";
import { FxQuote, StockQuote } from "./quote";

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

export function buildSameCurrencyQuote(fxPair: FxPair): FxQuote {
  const quoteCurrency = String(fxPair.quoteCanonicalCode || "")
    .trim()
    .toUpperCase();
  const metadata = resolveFxPairMetadata(fxPair);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return new FxQuote({
    currency: quoteCurrency,
    exchangeDataDelayedBy: 0,
    regularMarketPreviousClose: 1,
    regularMarketPrice: 1,
    regularMarketTime: nowSeconds,
    shortName: metadata.pairDisplay,
    googleSymbol: metadata.googleSymbol,
    fxUnitScale: metadata.scale,
    symbol: metadata.canonicalPair,
  });
}

export function decorateFxQuote(
  quote: StockQuote | Record<string, unknown>,
  fxPair: FxPair | null | undefined,
): FxQuote {
  const stockQuote = quote instanceof StockQuote ? quote : new StockQuote(quote as never);

  if (!fxPair) {
    return new FxQuote({
      currency: stockQuote.currency,
      exchangeDataDelayedBy: stockQuote.exchangeDataDelayedBy,
      fxUnitScale: stockQuote.fxUnitScale,
      googleSymbol: String((quote as Record<string, unknown>).googleSymbol || ""),
      regularMarketPreviousClose: stockQuote.regularMarketPreviousClose,
      regularMarketPrice: stockQuote.regularMarketPrice,
      regularMarketTime: stockQuote.regularMarketTime,
      shortName: stockQuote.shortName || "",
      symbol: stockQuote.symbol,
    });
  }

  const metadata = resolveFxPairMetadata(fxPair);
  return new FxQuote({
    currency: stockQuote.currency || metadata.displayQuoteCode,
    exchangeDataDelayedBy: stockQuote.exchangeDataDelayedBy,
    fxUnitScale: metadata.scale,
    googleSymbol: metadata.googleSymbol,
    regularMarketPreviousClose: stockQuote.regularMarketPreviousClose,
    regularMarketPrice: stockQuote.regularMarketPrice,
    regularMarketTime: stockQuote.regularMarketTime,
    shortName: metadata.pairDisplay,
    symbol: metadata.canonicalPair,
  });
}


