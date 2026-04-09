import type { TextHttpResponse } from "./text-http-response";

const TRADINGVIEW_SYMBOL_URL = "https://www.tradingview.com/symbols/";

export function buildIsraeliFundTradingviewFallbackInfo(
  yahooSymbol: string,
): {
  expectedSymbol: string;
  url: string;
  yahooSymbol: string;
} {
  const normalizedYahooSymbol = String(yahooSymbol || "")
    .trim()
    .toUpperCase();
  const code = normalizedYahooSymbol.replace(/\.TA$/i, "");

  return {
    expectedSymbol: `TASE:${code}`,
    url: `${TRADINGVIEW_SYMBOL_URL}TASE-${code}/`,
    yahooSymbol: normalizedYahooSymbol,
  };
}

function extractTradingviewResolvedSymbol(html: string): string {
  const match = String(html || "").match(/"resolved_symbol":"([^"]+)"/i);
  return match && match[1] ? match[1].toUpperCase() : "";
}

function extractTradingviewIsin(html: string): string {
  const match = String(html || "").match(
    /"isin_displayed":"([A-Z]{2}[A-Z0-9]{9}[0-9])"/i,
  );
  return match && match[1] ? match[1].toUpperCase() : "";
}

function extractTradingviewSymbolInfo(html: string): Record<string, unknown> | null {
  const match = String(html || "").match(
    /window\.initData\.symbolInfo\s*=\s*(\{[\s\S]*?\});/i,
  );

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1] || "") as Record<string, unknown>;
  } catch (_error) {
    return null;
  }
}

function extractTradingviewQuotePrice(html: string): number | null {
  const match = String(html || "").match(
    /\btrades at\s+([0-9.,\u00A0\u202F ]+)\s*([A-Z]{3})\s+today\b/i,
  );
  if (!match) {
    return null;
  }

  const normalized = String(match[1] || "")
    .replace(/[\u00A0\u202F\s]/g, "")
    .replace(/,/g, "");
  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

export function extractTradingviewFundQuote(
  html: string,
  yahooSymbol: string,
  expectedSymbol: string,
): Record<string, unknown> {
  const symbolInfo = extractTradingviewSymbolInfo(html);
  const resolvedSymbol =
    symbolInfo && symbolInfo.resolved_symbol
      ? String(symbolInfo.resolved_symbol).toUpperCase()
      : extractTradingviewResolvedSymbol(html);
  const price = extractTradingviewQuotePrice(html);
  const currency =
    symbolInfo && (symbolInfo.currency || symbolInfo.currency_code)
      ? String(symbolInfo.currency || symbolInfo.currency_code).toUpperCase()
      : "";
  const name = symbolInfo
    ? symbolInfo.description ||
      symbolInfo.short_description ||
      symbolInfo.local_description ||
      symbolInfo.short_name ||
      ""
    : "";
  const isin =
    symbolInfo && symbolInfo.isin_displayed
      ? String(symbolInfo.isin_displayed).toUpperCase()
      : extractTradingviewIsin(html);

  if (resolvedSymbol && expectedSymbol && resolvedSymbol !== expectedSymbol) {
    throw new Error(
      `TradingView resolved "${expectedSymbol}" to "${resolvedSymbol}" instead of an exact symbol match.`,
    );
  }

  if (!name) {
    throw new Error(
      `No TradingView quote name is available for "${expectedSymbol}".`,
    );
  }

  if (price == null) {
    throw new Error(
      `No TradingView quote price is available for "${expectedSymbol}".`,
    );
  }

  return {
    currency,
    exchangeName: "TASE",
    financialCurrency: currency,
    isin,
    longName: String(name),
    regularMarketPrice: price,
    shortName:
      symbolInfo && symbolInfo.short_name ? String(symbolInfo.short_name) : "",
    symbol: String(yahooSymbol || "").trim().toUpperCase(),
  };
}

export function extractTradingviewFundQuoteFromResponse(
  response: TextHttpResponse,
  yahooSymbol: string,
  expectedSymbol: string,
): Record<string, unknown> {
  if (response.getResponseCode() !== 200) {
    throw new Error(
      `TradingView quote lookup failed for "${expectedSymbol}" (${response.getResponseCode()}).`,
    );
  }

  return extractTradingviewFundQuote(
    response.getContentText(),
    yahooSymbol,
    expectedSymbol,
  );
}
