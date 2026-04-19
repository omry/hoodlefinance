import {
  extractYahooExchangeFromSymbol,
  isPrefixlessExchange,
  resolveExchangeSuffix,
} from "./exchange-symbols";
import type { TextHttpResponse } from "./text-http-response";

const YAHOO_EXCHANGE_BY_META_NAME: Record<string, string> = {
  AMEX: "AMEX",
  ARCA: "NYSEARCA",
  ARCX: "NYSEARCA",
  ASE: "AMEX",
  BATS: "BATS",
  NASDAQ: "NASDAQ",
  NCM: "NASDAQ",
  NEO: "NEO",
  NMS: "NASDAQ",
  NYQ: "NYSE",
  NYSE: "NYSE",
  "NYSE ARCA": "NYSEARCA",
  NYSEARCA: "NYSEARCA",
  OQX: "OTCMKTS",
  OTO: "OTCMKTS",
  PCX: "NYSEARCA",
  PNK: "OTCMKTS",
};

const GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY: Record<string, string> = {
  AMEX: "AMEX",
  ARCA: "NYSEARCA",
  ARCX: "NYSEARCA",
  ASE: "AMEX",
  BATS: "BATS",
  CURRENCY: "CURRENCY",
  NASDAQ: "NASDAQ",
  NCM: "NASDAQ",
  NEO: "NEO",
  NMS: "NASDAQ",
  NYQ: "NYSE",
  NYSE: "NYSE",
  "NYSE ARCA": "NYSEARCA",
  OQX: "OTCMKTS",
  OTO: "OTCMKTS",
  PCX: "NYSEARCA",
  PNK: "OTCMKTS",
  PSE: "PSE",
};

export function buildYahooIsinSearchUrl(isin: string): string {
  return (
    "https://query2.finance.yahoo.com/v1/finance/search?q=" +
    encodeURIComponent(isin) +
    "&quotesCount=10&newsCount=0"
  );
}

export function canRenderGoogleExchangeFromYahooIdentity(
  yahooExchange: string,
): boolean {
  const identity = String(yahooExchange || "")
    .trim()
    .toUpperCase();

  return Boolean(
    GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY[identity] ||
    identity === "TASE" ||
    isPrefixlessExchange(identity) ||
    resolveExchangeSuffix(identity),
  );
}

export function inferYahooExchangeFromSearchQuote(
  quote: Record<string, unknown> | null | undefined,
): string {
  const symbol =
    quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
  const rawExchange = String((quote && quote.exchange) || "")
    .trim()
    .toUpperCase();
  const suffixExchange = extractYahooExchangeFromSymbol(symbol);
  const mappedMetaExchange = rawExchange
    ? YAHOO_EXCHANGE_BY_META_NAME[rawExchange] || ""
    : "";

  if (suffixExchange) {
    return suffixExchange;
  }

  if (mappedMetaExchange) {
    return mappedMetaExchange;
  }

  if (
    rawExchange &&
    (GOOGLE_EXCHANGE_BY_YAHOO_IDENTITY[rawExchange] ||
      isPrefixlessExchange(rawExchange) ||
      resolveExchangeSuffix(rawExchange))
  ) {
    return rawExchange;
  }

  return "";
}

function scoreYahooIsinSearchQuote(
  quote: Record<string, unknown> | null | undefined,
): number {
  const symbol =
    quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";
  const yahooExchange = inferYahooExchangeFromSearchQuote(quote);
  const quoteType =
    quote && quote.quoteType
      ? String(quote.quoteType).trim().toUpperCase()
      : "";
  const numericScore = Number(quote && quote.score);
  let score = 0;

  if (!symbol || (quote && quote.isYahooFinance === false)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (
    yahooExchange &&
    canRenderGoogleExchangeFromYahooIdentity(yahooExchange)
  ) {
    score += 1000000;
  } else if (yahooExchange) {
    score += 100000;
  }

  if (quoteType === "ETF" || quoteType === "EQUITY") {
    score += 1000;
  } else if (quoteType === "MUTUALFUND") {
    score -= 1000;
  }

  if (!Number.isNaN(numericScore)) {
    score += numericScore;
  }

  return score;
}

export function selectYahooIsinSearchQuote(
  quotes: unknown,
): Record<string, unknown> | null {
  const candidates = Array.isArray(quotes) ? quotes : [];
  let bestQuote: Record<string, unknown> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateScore = scoreYahooIsinSearchQuote(
      candidate as Record<string, unknown>,
    );

    if (candidateScore > bestScore) {
      bestQuote = candidate as Record<string, unknown>;
      bestScore = candidateScore;
    }
  }

  return bestQuote;
}

export function extractYahooSymbolFromSearchPayload(
  payload: Record<string, unknown> | null | undefined,
  isin: string,
): string {
  const quotes = payload && "quotes" in payload ? payload.quotes : null;
  const quote = selectYahooIsinSearchQuote(quotes);
  const symbol =
    quote && quote.symbol ? String(quote.symbol).trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error(`No Yahoo Finance symbol was found for ISIN "${isin}".`);
  }

  return symbol;
}

export function extractYahooSymbolFromSearchResponse(
  response: TextHttpResponse,
  isin: string,
): string {
  if (response.getResponseCode() !== 200) {
    throw new Error(
      `ISIN lookup failed for "${isin}" (${response.getResponseCode()}).`,
    );
  }

  return extractYahooSymbolFromSearchPayload(
    JSON.parse(response.getContentText()),
    isin,
  );
}
