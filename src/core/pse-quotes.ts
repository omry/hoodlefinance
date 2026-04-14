import type { TextHttpResponse } from "./text-http-response";

const PSE_SEARCH_URL = "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=";
const PSE_STOCK_DATA_URL = "https://edge.pse.com.ph/companyPage/stockData.do";
const PSE_SECURITY_FRAME_URL = "https://frames.pse.com.ph/security/";
const PSE_LISTING_CACHE_KEY_PREFIX = "hoodlefinance:pse:listing:";

export interface PseListing {
  companyId: string;
  name: string;
  securityId: string;
  symbol: string;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(text: unknown): number | null {
  const match = String(text || "")
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;
}

function parseAsOf(html: string): Date | null {
  const match = String(html || "").match(/As of\s+([^<]+)/i);
  const value = match ? normalizeText(match[1]) : "";
  const parsed = value ? Date.parse(`${value} GMT+0800`) : NaN;

  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function buildPseSearchUrl(symbol: string): string {
  return `${PSE_SEARCH_URL}${encodeURIComponent(
    String(symbol || "")
      .trim()
      .toUpperCase(),
  )}`;
}

export function buildPseListingCacheKey(symbol: string): string {
  return `${PSE_LISTING_CACHE_KEY_PREFIX}${String(symbol || "")
    .trim()
    .toUpperCase()}`;
}

export function buildPseStockDataUrl(listing: Pick<PseListing, "companyId" | "securityId">): string {
  return `${PSE_STOCK_DATA_URL}?cmpy_id=${encodeURIComponent(
    String(listing.companyId || ""),
  )}&security_id=${encodeURIComponent(String(listing.securityId || ""))}`;
}

export function buildPseSecurityFrameUrl(symbol: string): string {
  return `${PSE_SECURITY_FRAME_URL}${encodeURIComponent(
    String(symbol || "")
      .trim()
      .toUpperCase(),
  )}`;
}

export function buildPseUnavailableError(detail: unknown): Error {
  const normalizedDetail = detail == null ? "" : String(detail).trim();

  return new Error(
    `The PSE data source is currently unavailable${
      normalizedDetail ? ` (${normalizedDetail})` : ""
    }. Please try again later.`,
  );
}

function buildPseHttpErrorMessage(statusCode: unknown): string {
  const numericCode = Number(statusCode);

  if (numericCode >= 520 && numericCode < 530) {
    return `PSE upstream returned Cloudflare HTTP ${numericCode}.`;
  }

  return `PSE upstream returned HTTP ${statusCode}.`;
}

export function isPseListingNotFoundError(error: unknown): boolean {
  return /No PSE listing was found for "/i.test(
    String((error as Error)?.message || error || ""),
  );
}

export function isPseUnavailableError(error: unknown): boolean {
  return /The PSE data source is currently unavailable/i.test(
    String((error as Error)?.message || error || ""),
  );
}

function extractPseListings(html: string): PseListing[] {
  const text = String(html || "");
  const pattern =
    /<tr>[\s\S]*?cmDetail\('(\d+)','(\d+)'\);return false;">([\s\S]*?)<\/a>[\s\S]*?<td class="alignC"><a[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/gi;
  const listings: PseListing[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    listings.push({
      companyId: String(match[1] || ""),
      name: normalizeText(match[3]),
      securityId: String(match[2] || ""),
      symbol: normalizeText(match[4]).toUpperCase(),
    });
  }

  return listings;
}

function findPseListingBySymbol(
  listings: PseListing[] | null | undefined,
  symbol: string,
): PseListing | null {
  const candidates = Array.isArray(listings) ? listings : [];
  const normalizedSymbol = String(symbol || "")
    .trim()
    .toUpperCase();

  for (const listing of candidates) {
    if (listing && listing.symbol === normalizedSymbol) {
      return listing;
    }
  }

  return null;
}

export function tryResolvePseListingFromHtml(
  html: string,
  symbol: string,
): PseListing | null {
  return findPseListingBySymbol(extractPseListings(html), symbol);
}

function extractPseField(html: string, label: string): string {
  const pattern = new RegExp(
    `<th>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<\\/th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const match = String(html || "").match(pattern);
  return match ? normalizeText(match[1]) : "";
}

function extractPseFrameField(html: string, label: string): string {
  const pattern = new RegExp(
    `<td[^>]*>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*(?:<span[^>]*>[\\s\\S]*?<\\/span>)?\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const match = String(html || "").match(pattern);
  return match ? normalizeText(match[1]) : "";
}

function extractPseFrameLastPrice(html: string): number | null {
  const match = String(html || "").match(
    /<h3[^>]*class="last-price"[^>]*>([\s\S]*?)<\/h3>/i,
  );
  return match ? parseNumber(match[1]) : null;
}

function extractPseFrameCompanyId(html: string): string {
  const match = String(html || "").match(
    /companyDisclosures\/form\.do\?cmpy_id=(\d+)/i,
  );
  return match ? String(match[1] || "") : "";
}

function extractPseFrameSymbol(html: string): string {
  const match = String(html || "").match(
    /<input[^>]+id="symbol-json"[^>]+value="([^"]+)"/i,
  );
  return match ? normalizeText(match[1]).toUpperCase() : "";
}

function extractPseFrameStockMetadata(html: string): Record<string, unknown> | null {
  const match = String(html || "").match(
    /<input[^>]+id="stock-json"[^>]+value="([^"]+)"/i,
  );
  const payloadText = match ? normalizeText(match[1]) : "";

  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(payloadText) as Record<string, unknown>;
  } catch (_error) {
    return null;
  }
}

function extractPseFrameHeaderCompanyName(html: string, symbol: string): string {
  const normalizedSymbol = String(symbol || "")
    .trim()
    .toUpperCase();
  const pattern = new RegExp(
    `<h3[^>]*>\\s*${normalizedSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<\\/h3>[\\s\\S]*?<div[^>]*>\\s*([^<]+?)\\s*<\\/div>`,
    "i",
  );
  const match = String(html || "").match(pattern);

  return match ? normalizeText(match[1]) : "";
}

function extractPseCompanyName(html: string): string {
  const match = String(html || "").match(
    /<div class="compInfo">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
  );
  return match ? normalizeText(match[1]) : "";
}

function extractPseSelectedSymbol(html: string): string {
  const match = String(html || "").match(
    /<option value="[^"]+" selected>([\s\S]*?)<\/option>/i,
  );
  return match ? normalizeText(match[1]).toUpperCase() : "";
}

function extractPseAsOf(html: string): Date | null {
  return parseAsOf(html);
}

function extractPseChange(text: string, price: number | null, previousClose: number | null): number | null {
  const value = parseNumber(text);

  if (value != null) {
    return /down/i.test(String(text || "")) ? -value : value;
  }

  if (price != null && previousClose != null) {
    return price - previousClose;
  }

  return null;
}

function extractPseChangePercent(
  text: string,
  change: number | null,
  previousClose: number | null,
): number | null {
  const match = String(text || "").match(/\(([-+]?\d[\d,]*(?:\.\d+)?)%\)/);

  if (match && match[1]) {
    return Number(match[1].replace(/,/g, "")) / 100;
  }

  if (change != null && previousClose) {
    return change / previousClose;
  }

  return null;
}

function buildPseQuote(fields: {
  isin: string;
  longName: string;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketOpen: number | null;
  regularMarketPreviousClose: number | null;
  regularMarketPrice: number | null;
  regularMarketTime: number | null;
  regularMarketVolume: number | null;
  shortName: string;
  symbol: string;
}): Record<string, unknown> {
  return {
    currency: "PHP",
    exchangeDataDelayedBy: 0,
    exchangeName: "PSE",
    financialCurrency: "PHP",
    ...fields,
    symbol: fields.symbol + ".PS",
  };
}

function extractPseQuote(
  html: string,
  listing: Pick<PseListing, "name" | "symbol"> | null | undefined,
): Record<string, unknown> {
  const previousClose = parseNumber(
    extractPseField(html, "Previous Close and Date"),
  );
  const lastPrice = parseNumber(extractPseField(html, "Last Traded Price"));
  const changeText = extractPseField(html, "Change(% Change)");
  const price = lastPrice != null ? lastPrice : previousClose;
  const asOf = extractPseAsOf(html);
  const change = extractPseChange(changeText, price, previousClose);
  const changePercent = extractPseChangePercent(
    changeText,
    change,
    previousClose,
  );

  const name = extractPseCompanyName(html) || (listing && listing.name) || "";

  return buildPseQuote({
    isin: extractPseField(html, "ISIN").toUpperCase(),
    longName: name,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketDayHigh: parseNumber(extractPseField(html, "High")),
    regularMarketDayLow: parseNumber(extractPseField(html, "Low")),
    regularMarketOpen: parseNumber(extractPseField(html, "Open")),
    regularMarketPreviousClose: previousClose,
    regularMarketPrice: price,
    regularMarketTime: asOf ? Math.floor(asOf.getTime() / 1000) : null,
    regularMarketVolume: parseNumber(extractPseField(html, "Volume")),
    shortName: name,
    symbol: extractPseSelectedSymbol(html) || (listing && listing.symbol) || "",
  });
}

export function extractPseQuoteFromResponse(
  response: TextHttpResponse,
  listing: Pick<PseListing, "name" | "symbol"> | null | undefined,
): Record<string, unknown> {
  if (response.getResponseCode() !== 200) {
    throw buildPseUnavailableError(
      buildPseHttpErrorMessage(response.getResponseCode()),
    );
  }

  return extractPseQuote(response.getContentText(), listing);
}

export function extractPseFrameQuote(
  html: string,
  symbol: string,
): Record<string, unknown> {
  const expectedSymbol = String(symbol || "")
    .trim()
    .toUpperCase();
  const metadata = extractPseFrameStockMetadata(html);
  const extractedSymbol =
    (metadata && metadata.name
      ? String(metadata.name).trim().toUpperCase()
      : "") ||
    extractPseFrameSymbol(html) ||
    expectedSymbol;
  const fullName =
    (metadata && metadata.full_name ? String(metadata.full_name).trim() : "") ||
    extractPseFrameHeaderCompanyName(html, extractedSymbol);
  const isin = extractPseFrameField(html, "ISIN").toUpperCase();
  const companyId = extractPseFrameCompanyId(html);
  const previousClose = parseNumber(extractPseFrameField(html, "Prev Close"));
  const lastPrice = extractPseFrameLastPrice(html);
  const price = lastPrice != null ? lastPrice : previousClose;
  const change =
    price != null && previousClose != null ? price - previousClose : null;
  const asOf = extractPseAsOf(html);

  if (
    !expectedSymbol ||
    extractedSymbol !== expectedSymbol ||
    !fullName ||
    !isin ||
    !companyId ||
    companyId === "0"
  ) {
    throw new Error(`No PSE listing was found for "${expectedSymbol}".`);
  }

  return buildPseQuote({
    isin,
    longName: fullName,
    regularMarketChange: change,
    regularMarketChangePercent:
      change != null && previousClose ? change / previousClose : null,
    regularMarketDayHigh: parseNumber(extractPseFrameField(html, "High")),
    regularMarketDayLow: parseNumber(extractPseFrameField(html, "Low")),
    regularMarketOpen: parseNumber(extractPseFrameField(html, "Open")),
    regularMarketPreviousClose: previousClose,
    regularMarketPrice: price,
    regularMarketTime: asOf ? Math.floor(asOf.getTime() / 1000) : null,
    regularMarketVolume: parseNumber(extractPseFrameField(html, "Volume")),
    shortName: fullName,
    symbol: extractedSymbol,
  });
}

export function extractPseFrameQuoteFromResponse(
  response: TextHttpResponse,
  symbol: string,
): Record<string, unknown> {
  if (response.getResponseCode() !== 200) {
    throw buildPseUnavailableError(
      buildPseHttpErrorMessage(response.getResponseCode()),
    );
  }

  return extractPseFrameQuote(response.getContentText(), symbol);
}
