import {
  EquityRequest,
  FxRequest,
  RequestInput,
  type AttributeRequest,
  type FxPair,
  type ParsedTickerRequest,
  type ResolvedRequest,
  looksLikeIsin,
} from "./request";
import {
  normalizeAttribute,
  parseAttributeRequest,
  parseTickerRequest,
} from "./request-parsing";
import {
  extractTickerExchange,
  extractYahooExchangeFromSymbol,
  looksLikeIsraeliFundYahooSymbol,
  parseExchangePrefixedSymbol,
  parseYahooSuffixedSymbol,
} from "./exchange-symbols";
import {
  parseFxTicker,
} from "./fx-normalization";
import { isDefaultSourceOverrideName } from "./source-overrides";
import { normalizeTickerWithoutIsin } from "./ticker-normalization";

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

const DEFAULT_REQUEST_BUILDING_DEPENDENCIES: RequestBuildingDependencies = {
  extractTickerExchange,
  extractYahooExchangeFromSymbol,
  looksLikeIsraeliFundYahooSymbol,
  looksLikeIsin,
  normalizeAttribute,
  normalizeTickerWithoutIsin,
  parseAttributeRequest,
  parseFxTicker,
  parseTickerRequest(ticker: string): ParsedTickerRequest {
    return parseTickerRequest(ticker, isDefaultSourceOverrideName);
  },
};

export function extractIsinFromRequestInput(
  input: Pick<RequestInput, "ticker">,
  looksLikeIsin?: (value: string) => boolean,
): string {
  const resolvedLooksLikeIsin =
    looksLikeIsin || DEFAULT_REQUEST_BUILDING_DEPENDENCIES.looksLikeIsin;
  const ticker = String(input.ticker || "").trim();
  const upperTicker = ticker.toUpperCase();

  if (resolvedLooksLikeIsin(ticker)) {
    return upperTicker;
  }

  return upperTicker.startsWith("ISIN:") ? upperTicker.slice(5).trim() : "";
}

export function extractIsinCountryCode(
  input: Pick<RequestInput, "ticker">,
  looksLikeIsin?: (value: string) => boolean,
): string {
  const isin = extractIsinFromRequestInput(input, looksLikeIsin);

  return isin ? isin.slice(0, 2).toUpperCase() : "";
}

export function createRequestInput(
  identifier: unknown,
  attribute: unknown,
  deps?: Partial<RequestBuildingDependencies>,
): RequestInput {
  const resolvedDeps = {
    ...DEFAULT_REQUEST_BUILDING_DEPENDENCIES,
    ...(deps || {}),
  };

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
  deps?: Partial<RequestBuildingDependencies>,
): ResolvedRequest {
  const resolvedDeps = {
    ...DEFAULT_REQUEST_BUILDING_DEPENDENCIES,
    ...(deps || {}),
  };
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
  deps?: Partial<RequestBuildingDependencies>,
): ResolvedRequest {
  const resolvedDeps = {
    ...DEFAULT_REQUEST_BUILDING_DEPENDENCIES,
    ...(deps || {}),
  };
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
