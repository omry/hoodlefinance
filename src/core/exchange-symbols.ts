const EXCHANGE_SUFFIXES: Record<string, string> = {
  AMS: ".AS",
  ASX: ".AX",
  BIT: ".MI",
  BMV: ".MX",
  BOM: ".BO",
  BRU: ".BR",
  BSE: ".BO",
  BVMF: ".SA",
  CPH: ".CO",
  CVE: ".V",
  EPA: ".PA",
  ETR: ".DE",
  FRA: ".F",
  HEL: ".HE",
  HKG: ".HK",
  ICE: ".IC",
  IST: ".IS",
  JSE: ".JO",
  KOSDAQ: ".KQ",
  KRX: ".KS",
  LON: ".L",
  MAD: ".MC",
  NEO: ".NE",
  NSE: ".NS",
  NZE: ".NZ",
  OSL: ".OL",
  PAR: ".PA",
  PSE: ".PS",
  SGX: ".SI",
  SHA: ".SS",
  SHE: ".SZ",
  SIX: ".SW",
  STO: ".ST",
  SWX: ".SW",
  TASE: ".TA",
  TLV: ".TA",
  TPE: ".TW",
  TSX: ".TO",
  TSE: ".TO",
  TYO: ".T",
  VIE: ".VI",
  WSE: ".WA",
};

const PREFIXLESS_EXCHANGES = new Set([
  "AMEX",
  "ARCA",
  "BATS",
  "INDEXDJX",
  "INDEXNASDAQ",
  "INDEXRUSSELL",
  "INDEXSP",
  "NASDAQ",
  "NYSE",
  "NYSEAMERICAN",
  "NYSEARCA",
  "OTCMKTS",
]);

const YAHOO_EXCHANGE_BY_SUFFIX: Record<string, string> = {
  AS: "AMS",
  AX: "ASX",
  BO: "BOM",
  BR: "BRU",
  CO: "CPH",
  DE: "ETR",
  F: "FRA",
  HE: "HEL",
  HK: "HKG",
  IC: "ICE",
  IS: "IST",
  JO: "JSE",
  KQ: "KOSDAQ",
  KS: "KRX",
  L: "LON",
  MC: "MAD",
  MI: "BIT",
  MX: "BMV",
  NE: "NEO",
  NS: "NSE",
  NZ: "NZE",
  OL: "OSL",
  PA: "PAR",
  PS: "PSE",
  SA: "BVMF",
  SI: "SGX",
  SS: "SHA",
  ST: "STO",
  SW: "SIX",
  SZ: "SHE",
  T: "TYO",
  TA: "TLV",
  TO: "TSX",
  TW: "TPE",
  V: "CVE",
  VI: "VIE",
  WA: "WSE",
};

const KNOWN_IBKR_EXCHANGES = new Set([
  "AEB",
  "AMEX",
  "ARCA",
  "ASX",
  "BATS",
  "BM",
  "BOVESPA",
  "BSE",
  "BVME",
  "CSE",
  "EBS",
  "ENEXT.BE",
  "FWB",
  "HEX",
  "IBIS",
  "ICEX",
  "INDEX",
  "ISE",
  "JSE",
  "KOSDAQ",
  "KSE",
  "LSEETF",
  "MEXI",
  "NASDAQ",
  "NSE",
  "NYSE",
  "NZSE",
  "OSE",
  "PINK",
  "SBF",
  "SFB",
  "SEHK",
  "TSE",
  "TSEJ",
  "VENTURE",
  "VSE",
  "WSE",
]);
 
export const YAHOO_EXCHANGE_BY_META_NAME: Record<string, string> = {
  AMEX: "AMEX",
  ARCA: "NYSEARCA",
  ARCX: "NYSEARCA",
  ASE: "AMEX",
  BATS: "BATS",
  NASDAQ: "NASDAQ",
  NASDAQGS: "NASDAQ",
  NCM: "NASDAQ",
  NEO: "NEO",
  NGM: "NASDAQ",
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

export function normalizeExplicitIbkrExchange(exchange: string): string {
  const normalizedExchange = String(exchange || "")
    .trim()
    .toUpperCase();

  return KNOWN_IBKR_EXCHANGES.has(normalizedExchange) ? normalizedExchange : "";
}

export function normalizeIsraeliFundCode(code: string): string {
  const value = String(code || "")
    .trim()
    .toUpperCase();
  const undottedMatch = value.match(/^([A-Z]+)F([0-9]+)$/);
  const dottedMatch = value.match(/^([A-Z]+)\.F([0-9]+)$/);

  if (undottedMatch) {
    return `${undottedMatch[1]}.F${undottedMatch[2]}`;
  }

  if (dottedMatch) {
    return `${dottedMatch[1]}.F${dottedMatch[2]}`;
  }

  return value;
}

export function normalizeYahooStyleIsraeliFundTicker(ticker: string): string {
  const match = String(ticker || "")
    .trim()
    .match(/^(.+)\.TA$/i);

  if (!match) {
    return String(ticker || "").trim();
  }

  return `${normalizeIsraeliFundCode(match[1] || "")}.TA`;
}

export function resolveGoogleExchange(symbol: string, exchangeMeta: string): string {
  const suffixExchange = extractYahooExchangeFromSymbol(symbol);
  if (suffixExchange) {
    return YAHOO_EXCHANGE_BY_META_NAME[suffixExchange] || suffixExchange;
  }

  const rawExchange = exchangeMeta.trim().toUpperCase();
  if (!rawExchange) {
    return "";
  }

  return YAHOO_EXCHANGE_BY_META_NAME[rawExchange] || rawExchange;
}

export function normalizeExchangeSymbol(exchange: string, symbol: string): string {
  return exchange === "TLV" || exchange === "TASE"
    ? normalizeIsraeliFundCode(symbol)
    : symbol;
}

export function extractTickerExchange(ticker: string): string {
  const value = String(ticker || "")
    .trim()
    .toUpperCase();
  const parts = value.split(":");
  const exchange = parts.length > 1 ? parts[0] : "";

  if (!exchange || exchange === "CURRENCY" || exchange === "ISIN") {
    return "";
  }

  if (
    exchange === "PSE" ||
    PREFIXLESS_EXCHANGES.has(exchange) ||
    !!EXCHANGE_SUFFIXES[exchange] ||
    !!normalizeExplicitIbkrExchange(exchange)
  ) {
    return exchange;
  }

  return "";
}

export function extractYahooExchangeFromSymbol(symbol: string): string {
  const match = String(symbol || "")
    .trim()
    .toUpperCase()
    .match(/\.([A-Z0-9]+)$/);
  const suffix = match ? match[1] : "";

  return suffix ? YAHOO_EXCHANGE_BY_SUFFIX[suffix] || "" : "";
}

export function parseExchangePrefixedSymbol(
  ticker: string,
  exchangeLabel: string,
): string {
  const value = String(ticker || "").trim();
  const parts = value.split(":");
  const symbol =
    parts.length > 1 ? parts.slice(1).join(":").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error(`${exchangeLabel} ticker "${ticker}" is invalid.`);
  }

  return symbol;
}

export function parseYahooSuffixedSymbol(
  ticker: string,
  suffix: string,
  exchangeLabel: string,
): string {
  const match = String(ticker || "")
    .trim()
    .match(new RegExp(`^(.+)\\.${String(suffix || "").trim()}$`, "i"));
  const symbol = match
    ? String(match[1] || "")
        .trim()
        .toUpperCase()
    : "";

  if (!symbol) {
    throw new Error(`${exchangeLabel} ticker "${ticker}" is invalid.`);
  }

  return symbol;
}

export function looksLikeIsraeliFundYahooSymbol(symbol: string): boolean {
  return /^[A-Z]+\.F[0-9]+\.TA$/i.test(String(symbol || "").trim());
}

export function resolveExchangeSuffix(exchange: string): string {
  return EXCHANGE_SUFFIXES[exchange] || "";
}

export function isPrefixlessExchange(exchange: string): boolean {
  return PREFIXLESS_EXCHANGES.has(exchange);
}
