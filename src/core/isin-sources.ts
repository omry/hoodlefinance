import { buildPseSecurityFrameUrl, extractPseFrameQuote } from "./pse-quotes";
import type { ResolverServices } from "./resolver-services";

const TRADINGVIEW_SYMBOL_URL = "https://www.tradingview.com/symbols/";
const LON_ISIN_CACHE_TTL_SECONDS = 21600;

function extractLonCode(tickerInput: string): string {
  const normalized = String(tickerInput || "")
    .trim()
    .toUpperCase();

  if (normalized.startsWith("LON:")) {
    return normalized.slice(4).trim().toUpperCase();
  }

  if (normalized.endsWith(".L")) {
    return normalized.slice(0, -2).trim().toUpperCase();
  }

  return normalized;
}

function extractLonCodeFromContext(
  tickerInput: string,
  quoteSymbol: string,
): string {
  const candidates = [tickerInput, quoteSymbol];

  for (const candidate of candidates) {
    const code = extractLonCode(candidate);

    if (
      code &&
      code !==
        String(candidate || "")
          .trim()
          .toUpperCase()
    ) {
      return code;
    }
  }

  return "";
}

function extractLonIsinFromHtml(html: string, code: string): string {
  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();
  const pattern = /UpdateOpener\(\s*'[^']*'\s*,\s*'([^']+)'\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(String(html || "")))) {
    const payload = String(match[1] || "")
      .trim()
      .split("|");
    const isin = payload[0] ? String(payload[0]).trim().toUpperCase() : "";
    const rowCode = payload[5] ? String(payload[5]).trim().toUpperCase() : "";

    if (isin && rowCode === normalizedCode) {
      return isin;
    }
  }

  return "";
}

export function buildTradingviewIsinLookupUrl(
  tradingviewExchange: string,
  code: string,
): string {
  return `${TRADINGVIEW_SYMBOL_URL}${tradingviewExchange}-${code}/`;
}

export function extractTradingviewIsinFromHtml(
  html: string,
  expectedSymbol: string,
  displaySymbol: string,
): string {
  const resolvedSymbolMatch = String(html || "").match(
    /"resolved_symbol":"([^"]+)"/i,
  );
  const resolvedSymbol =
    resolvedSymbolMatch && resolvedSymbolMatch[1]
      ? resolvedSymbolMatch[1].toUpperCase()
      : "";
  const isinMatch = String(html || "").match(
    /"isin_displayed":"([A-Z]{2}[A-Z0-9]{9}[0-9])"/i,
  );
  const isin = isinMatch && isinMatch[1] ? isinMatch[1].toUpperCase() : "";

  if (resolvedSymbol && expectedSymbol && resolvedSymbol !== expectedSymbol) {
    throw new Error(
      `TradingView resolved "${displaySymbol}" to "${resolvedSymbol}" instead of an exact symbol match.`,
    );
  }

  if (!isin) {
    throw new Error(`No TradingView ISIN is available for "${displaySymbol}".`);
  }

  return isin;
}

export function resolvePseIsinBySymbol(
  symbol: string,
  httpFetch: ResolverServices["httpFetch"],
): string {
  const normalizedSymbol = String(symbol || "")
    .trim()
    .toUpperCase();

  if (!normalizedSymbol) {
    throw new Error(
      "Could not determine the ticker code needed for PSE ISIN lookup.",
    );
  }

  const quote = extractPseFrameQuote(
    httpFetch(buildPseSecurityFrameUrl(normalizedSymbol)).getContentText(),
    normalizedSymbol,
  );
  const isin = String(quote.isin || "")
    .trim()
    .toUpperCase();

  if (!isin) {
    throw new Error("No PSE ISIN is available for this ticker.");
  }

  return isin;
}

function resolveLonIsinByCode(
  code: string,
  services: ResolverServices,
): string {
  if (!code) {
    throw new Error(
      "Could not determine the ticker code needed for LON ISIN lookup.",
    );
  }

  const cacheKey = `hoodlefinance:lon:isin:${code}`;
  const cached = services.getCachedString(cacheKey);

  if (cached) {
    return cached;
  }

  const html = services
    .httpFetch(
      `https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=${encodeURIComponent(code)}`,
    )
    .getContentText();
  const isin = extractLonIsinFromHtml(html, code);

  if (!isin) {
    throw new Error(`No LON ISIN is available for "${code}".`);
  }

  services.putCachedString(cacheKey, isin, LON_ISIN_CACHE_TTL_SECONDS);
  return isin;
}

export function resolveLonIsin(
  tickerInput: string,
  quoteSymbol: string,
  services: ResolverServices,
): string {
  const code = extractLonCodeFromContext(tickerInput, quoteSymbol);
  return resolveLonIsinByCode(code, services);
}
