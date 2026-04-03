import {
  EquityRequest,
  FxRequest,
  RequestInput,
  type AttributeRequest,
  type FxPair,
  type ParsedTickerRequest,
  type ResolvedRequest,
} from "./request";
import {
  normalizeAttribute,
  parseAttributeRequest,
  parseTickerRequest,
} from "./request-parsing";
import { PLAN_SPECS_BY_CODE, RESOLVER_SPECS_BY_CODE } from "./spec-data";

declare function require(path: string): unknown;

export interface RequestBuildingDependencies {
  extractTickerExchange(ticker: string): string;
  extractYahooExchangeFromSymbol(symbol: string): string;
  looksLikeIsraeliFundYahooSymbol(symbol: string): boolean;
  looksLikeIsin(value: string): boolean;
  normalizeAttribute(attribute: unknown): string;
  normalizeTickerWithoutIsin(ticker: string): string;
  parseAttributeRequest(attribute: string): AttributeRequest;
  parseFxTicker(ticker: string): FxPair | null;
  parseTickerRequest(ticker: string): ParsedTickerRequest;
}

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
  PA: "EPA",
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
  "SEHK",
  "TSE",
  "TSEJ",
  "VENTURE",
  "VSE",
  "WSE",
]);

function buildSourceOverrideNameSet(): Set<string> {
  const names = new Set<string>();

  for (const [code, spec] of Object.entries(RESOLVER_SPECS_BY_CODE)) {
    if (spec.options?.isSourceOverrideable === true) {
      names.add(String(spec.options.sourceName || code).trim().toUpperCase());
    }
  }

  for (const [code, spec] of Object.entries(PLAN_SPECS_BY_CODE)) {
    if (spec.options?.isSourceOverrideable === true) {
      names.add(String(spec.options.sourceName || code).trim().toUpperCase());
    }
  }

  return names;
}

const DEFAULT_SOURCE_OVERRIDE_NAMES = buildSourceOverrideNameSet();

interface CurrencyCodeAliasEntry {
  canonicalCode?: string;
  factor?: number;
}

interface CurrencyCodePayload {
  aliases?: Record<string, CurrencyCodeAliasEntry>;
  canonicalCodes?: string[];
  cryptoCodes?: string[];
}

interface CurrencyUnit {
  assetClass: "currency" | "crypto";
  canonicalCode: string;
  displayCode: string;
  factor: number;
}

function buildDefaultCurrencyUnits(
  payload: CurrencyCodePayload,
): Record<string, CurrencyUnit> {
  const unitsByCode: Record<string, CurrencyUnit> = {};
  const aliasPayload =
    payload && payload.aliases && typeof payload.aliases === "object"
      ? payload.aliases
      : {};
  const cryptoCodeList = Array.isArray(payload?.cryptoCodes)
    ? payload.cryptoCodes
    : [];
  const canonicalCodeList = Array.isArray(payload?.canonicalCodes)
    ? payload.canonicalCodes
    : [];

  for (const code of canonicalCodeList) {
    const canonicalCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3}$/.test(canonicalCode)) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "currency",
      canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  for (const code of cryptoCodeList) {
    const canonicalCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3,4}$/.test(canonicalCode) || unitsByCode[canonicalCode]) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "crypto",
      canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  for (const aliasCode of Object.keys(aliasPayload)) {
    const aliasEntry = aliasPayload[aliasCode] || {};
    const normalizedAliasCode = String(aliasCode || "").trim();
    const aliasCanonicalCode = String(aliasEntry.canonicalCode || "")
      .trim()
      .toUpperCase();
    const factor = Number(aliasEntry.factor);

    if (
      !/^[A-Za-z]{3,4}$/.test(normalizedAliasCode) ||
      !unitsByCode[aliasCanonicalCode] ||
      !isFinite(factor) ||
      factor <= 0
    ) {
      continue;
    }

    unitsByCode[normalizedAliasCode] = {
      assetClass: unitsByCode[aliasCanonicalCode]?.assetClass || "currency",
      canonicalCode: aliasCanonicalCode,
      displayCode: normalizedAliasCode,
      factor,
    };

    const upperAliasCode = normalizedAliasCode.toUpperCase();

    if (!unitsByCode[upperAliasCode]) {
      unitsByCode[upperAliasCode] = unitsByCode[normalizedAliasCode];
    }
  }

  return unitsByCode;
}

const DEFAULT_CURRENCY_UNITS = buildDefaultCurrencyUnits(
  require("../../../data/currency-codes.json") as CurrencyCodePayload,
);

function defaultLooksLikeIsin(value: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value || "").trim());
}

function defaultNormalizeExplicitIbkrExchange(exchange: string): string {
  const normalizedExchange = String(exchange || "")
    .trim()
    .toUpperCase();

  return KNOWN_IBKR_EXCHANGES.has(normalizedExchange) ? normalizedExchange : "";
}

function defaultNormalizeIsraeliFundCode(code: string): string {
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

function defaultNormalizeYahooStyleIsraeliFundTicker(ticker: string): string {
  const match = String(ticker || "")
    .trim()
    .match(/^(.+)\.TA$/i);

  if (!match) {
    return String(ticker || "").trim();
  }

  return `${defaultNormalizeIsraeliFundCode(match[1] || "")}.TA`;
}

function defaultNormalizeExchangeSymbol(
  exchange: string,
  symbol: string,
): string {
  return exchange === "TLV" || exchange === "TASE"
    ? defaultNormalizeIsraeliFundCode(symbol)
    : symbol;
}

function defaultBuildFxPair(baseCode: string, quoteCode: string): FxPair {
  const baseUnit = DEFAULT_CURRENCY_UNITS[String(baseCode || "").trim()];
  const quoteUnit = DEFAULT_CURRENCY_UNITS[String(quoteCode || "").trim()];

  if (!baseUnit || !quoteUnit) {
    throw new Error("Currency ticker must use supported 3- or 4-character currency codes.");
  }

  return {
    baseCanonicalCode: baseUnit.canonicalCode,
    quoteCanonicalCode: quoteUnit.canonicalCode,
    yahooChartSymbol:
      baseUnit.assetClass === "crypto" || quoteUnit.assetClass === "crypto"
        ? `${baseUnit.canonicalCode}-${quoteUnit.canonicalCode}`
        : `${baseUnit.canonicalCode}${quoteUnit.canonicalCode}=X`,
  };
}

function defaultFindCompactFxPairCandidates(pairText: string): FxPair[] {
  const candidates: FxPair[] = [];

  for (let baseLength = 3; baseLength <= 4; baseLength += 1) {
    const quoteLength = pairText.length - baseLength;

    if (quoteLength < 3 || quoteLength > 4) {
      continue;
    }

    const baseCode = pairText.slice(0, baseLength);
    const quoteCode = pairText.slice(baseLength);

    if (!/^[A-Za-z]{3,4}$/.test(baseCode) || !/^[A-Za-z]{3,4}$/.test(quoteCode)) {
      continue;
    }

    if (!DEFAULT_CURRENCY_UNITS[baseCode] || !DEFAULT_CURRENCY_UNITS[quoteCode]) {
      continue;
    }

    candidates.push(defaultBuildFxPair(baseCode, quoteCode));
  }

  return candidates;
}

function defaultIsSourceOverrideName(source: string): boolean {
  return DEFAULT_SOURCE_OVERRIDE_NAMES.has(
    String(source || "")
      .trim()
      .toUpperCase(),
  );
}

function defaultParseFxTicker(ticker: string): FxPair | null {
  const strippedTicker = parseTickerRequest(ticker, defaultIsSourceOverrideName).ticker;
  const value = String(strippedTicker || "").trim();
  const explicitMatch = value.match(/^([^:]+):(.*)$/);
  const exchange = explicitMatch?.[1]?.trim().toUpperCase() || "";
  const pairText = explicitMatch?.[2]?.trim() || value;
  const dottedMatch = explicitMatch
    ? pairText.match(/^([A-Za-z]{3,4})\.([A-Za-z]{3,4})$/)
    : null;
  const looksLikeCompactPair = /^[A-Za-z]{6,8}$/.test(pairText);
  const compactCandidates = looksLikeCompactPair
    ? defaultFindCompactFxPairCandidates(pairText)
    : [];

  if (explicitMatch && exchange !== "CURRENCY") {
    return null;
  }

  if (dottedMatch) {
    const baseCode = dottedMatch[1] || "";
    const quoteCode = dottedMatch[2] || "";

    if (!DEFAULT_CURRENCY_UNITS[baseCode] || !DEFAULT_CURRENCY_UNITS[quoteCode]) {
      throw new Error(
        `Currency ticker "${ticker}" must use supported 3- or 4-character currency codes.`,
      );
    }

    return defaultBuildFxPair(baseCode, quoteCode);
  }

  if (explicitMatch && !looksLikeCompactPair) {
    throw new Error(
      `Currency ticker "${ticker}" must look like CURRENCY:USDEUR or CURRENCY:USDT.USD.`,
    );
  }

  if (!looksLikeCompactPair || compactCandidates.length !== 1) {
    if (explicitMatch && !compactCandidates.length) {
      throw new Error(
        `Currency ticker "${ticker}" must use supported 3- or 4-character currency codes.`,
      );
    }

    return null;
  }

  return compactCandidates[0] || null;
}

function defaultNormalizeTickerWithoutIsin(ticker: string): string {
  const strippedTicker = parseTickerRequest(ticker, defaultIsSourceOverrideName).ticker;
  const value = String(strippedTicker || "").trim();
  const fxPair = defaultParseFxTicker(value);
  const parts = value.split(":");

  if (fxPair) {
    return fxPair.yahooChartSymbol;
  }

  if (parts.length < 2) {
    return defaultNormalizeYahooStyleIsraeliFundTicker(value);
  }

  const exchange = (parts[0] || "").trim().toUpperCase();
  const symbol = parts.slice(1).join(":").trim();

  if (!symbol) {
    throw new Error(`Ticker "${ticker}" is invalid.`);
  }

  if (PREFIXLESS_EXCHANGES.has(exchange)) {
    return symbol;
  }

  if (EXCHANGE_SUFFIXES[exchange]) {
    return `${defaultNormalizeExchangeSymbol(exchange, symbol)}${EXCHANGE_SUFFIXES[exchange]}`;
  }

  if (defaultNormalizeExplicitIbkrExchange(exchange)) {
    return symbol;
  }

  throw new Error(
    `Unsupported exchange prefix "${exchange}" in ticker "${ticker}".`,
  );
}

function defaultExtractTickerExchange(ticker: string): string {
  const strippedTicker = parseTickerRequest(ticker, defaultIsSourceOverrideName).ticker;
  const value = String(strippedTicker || "")
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
    !!defaultNormalizeExplicitIbkrExchange(exchange)
  ) {
    return exchange;
  }

  return "";
}

function defaultExtractYahooExchangeFromSymbol(symbol: string): string {
  const match = String(symbol || "")
    .trim()
    .toUpperCase()
    .match(/\.([A-Z0-9]+)$/);
  const suffix = match ? match[1] : "";

  return suffix ? YAHOO_EXCHANGE_BY_SUFFIX[suffix] || "" : "";
}

function parseExchangePrefixedSymbol(ticker: string, exchangeLabel: string): string {
  const strippedTicker = parseTickerRequest(
    ticker,
    defaultIsSourceOverrideName,
  ).ticker;
  const value = String(strippedTicker || "").trim();
  const parts = value.split(":");
  const symbol =
    parts.length > 1 ? parts.slice(1).join(":").trim().toUpperCase() : "";

  if (!symbol) {
    throw new Error(`${exchangeLabel} ticker "${ticker}" is invalid.`);
  }

  return symbol;
}

function parseYahooSuffixedSymbol(
  ticker: string,
  suffix: string,
  exchangeLabel: string,
): string {
  const strippedTicker = parseTickerRequest(
    ticker,
    defaultIsSourceOverrideName,
  ).ticker;
  const match = String(strippedTicker || "")
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

function defaultLooksLikeIsraeliFundYahooSymbol(symbol: string): boolean {
  return /^[A-Z]+\.F[0-9]+\.TA$/i.test(String(symbol || "").trim());
}

const DEFAULT_REQUEST_BUILDING_DEPENDENCIES: RequestBuildingDependencies = {
  extractTickerExchange: defaultExtractTickerExchange,
  extractYahooExchangeFromSymbol: defaultExtractYahooExchangeFromSymbol,
  looksLikeIsraeliFundYahooSymbol: defaultLooksLikeIsraeliFundYahooSymbol,
  looksLikeIsin: defaultLooksLikeIsin,
  normalizeAttribute,
  normalizeTickerWithoutIsin: defaultNormalizeTickerWithoutIsin,
  parseAttributeRequest,
  parseFxTicker: defaultParseFxTicker,
  parseTickerRequest(ticker: string): ParsedTickerRequest {
    return parseTickerRequest(ticker, defaultIsSourceOverrideName);
  },
};

export function extractIsinFromRequestInput(
  input: Pick<RequestInput, "ticker" | "upperTicker">,
  looksLikeIsin?: (value: string) => boolean,
): string {
  const resolvedLooksLikeIsin =
    looksLikeIsin || DEFAULT_REQUEST_BUILDING_DEPENDENCIES.looksLikeIsin;
  const ticker = String(input.ticker || "").trim();
  const upperTicker = String(input.upperTicker || "").trim();

  if (resolvedLooksLikeIsin(ticker)) {
    return upperTicker;
  }

  return upperTicker.startsWith("ISIN:") ? upperTicker.slice(5).trim() : "";
}

export function createRequestInput(
  identifier: unknown,
  attribute: unknown,
  deps?: RequestBuildingDependencies,
): RequestInput {
  const resolvedDeps = deps || DEFAULT_REQUEST_BUILDING_DEPENDENCIES;

  return new RequestInput(identifier, attribute, {
    looksLikeIsin: resolvedDeps.looksLikeIsin,
    normalizeAttribute: resolvedDeps.normalizeAttribute,
    parseAttributeRequest: resolvedDeps.parseAttributeRequest,
    parseFxTicker: resolvedDeps.parseFxTicker,
    parseTickerRequest: resolvedDeps.parseTickerRequest,
  });
}

export function buildTypedRequestFromParsedInput(
  originalInput: Pick<RequestInput, "attribute" | "identifier">,
  parsedInput: Pick<RequestInput, "fxPair" | "ticker">,
  identifierResolutionMs: number,
  deps?: RequestBuildingDependencies,
): ResolvedRequest {
  const resolvedDeps = deps || DEFAULT_REQUEST_BUILDING_DEPENDENCIES;
  const resolvedTicker = String(parsedInput.ticker || "").trim();
  const fxPair =
    parsedInput.fxPair || resolvedDeps.parseFxTicker(resolvedTicker);
  const explicitExchange = resolvedDeps.extractTickerExchange(resolvedTicker);
  const yahooExchangeFromResolvedTicker =
    resolvedDeps.extractYahooExchangeFromSymbol(resolvedTicker);

  if (explicitExchange === "PSE") {
    const symbol = parseExchangePrefixedSymbol(resolvedTicker, "PSE");

    return new EquityRequest({
      allowTradingviewFallback: false,
      attribute: originalInput.attribute,
      exchange: "PSE",
      identifier: originalInput.identifier,
      identifierResolutionMs,
      symbol,
      yahooSymbol: `${symbol}.PS`,
    });
  }

  if (yahooExchangeFromResolvedTicker === "PSE") {
    const symbol = parseYahooSuffixedSymbol(resolvedTicker, "PS", "PSE");

    return new EquityRequest({
      allowTradingviewFallback: false,
      attribute: originalInput.attribute,
      exchange: "PSE",
      identifier: originalInput.identifier,
      identifierResolutionMs,
      symbol,
      yahooSymbol: `${symbol}.PS`,
    });
  }

  if (fxPair) {
    return new FxRequest({
      attribute: originalInput.attribute,
      fxPair,
      identifier: originalInput.identifier,
      identifierResolutionMs,
    });
  }

  const normalizedYahooTicker =
    resolvedDeps.normalizeTickerWithoutIsin(resolvedTicker);
  const yahooExchange = resolvedDeps.extractYahooExchangeFromSymbol(
    normalizedYahooTicker,
  );
  const symbol = explicitExchange
    ? String(resolvedTicker).split(":").slice(1).join(":").trim().toUpperCase()
    : normalizedYahooTicker;

  return new EquityRequest({
    allowTradingviewFallback: resolvedDeps.looksLikeIsraeliFundYahooSymbol(
      normalizedYahooTicker,
    ),
    attribute: originalInput.attribute,
    exchange: explicitExchange || yahooExchange,
    identifier: originalInput.identifier,
    identifierResolutionMs,
    symbol,
    yahooSymbol: normalizedYahooTicker,
  });
}

export function buildTypedRequestFromResolvedTicker(
  originalInput: Pick<RequestInput, "attribute" | "identifier">,
  resolvedTicker: string,
  identifierResolutionMs: number,
  deps?: RequestBuildingDependencies,
): ResolvedRequest {
  const resolvedDeps = deps || DEFAULT_REQUEST_BUILDING_DEPENDENCIES;
  const parsedResolvedInput = createRequestInput(
    resolvedTicker,
    originalInput.attribute,
    resolvedDeps,
  );

  return buildTypedRequestFromParsedInput(
    originalInput,
    parsedResolvedInput,
    identifierResolutionMs,
    resolvedDeps,
  );
}
