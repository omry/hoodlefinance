import {
  EquityRequest,
  FxRequest,
  RequestInput,
  type FxPair,
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
import { parseFxTicker } from "./fx-normalization";
import { normalizeTickerWithoutIsin } from "./ticker-normalization";

interface RequestBuildingDependencies {
  extractTickerExchange(ticker: string): string;
  extractYahooExchangeFromSymbol(symbol: string): string;
  looksLikeIsraeliFundYahooSymbol(symbol: string): boolean;
  looksLikeIsin(value: string): boolean;
  normalizeTickerWithoutIsin(ticker: string): string;
  parseFxTicker(ticker: string): FxPair | null;
}

const DEFAULT_REQUEST_BUILDING_DEPENDENCIES: RequestBuildingDependencies = {
  extractTickerExchange,
  extractYahooExchangeFromSymbol,
  looksLikeIsraeliFundYahooSymbol,
  looksLikeIsin,
  normalizeTickerWithoutIsin,
  parseFxTicker,
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
): RequestInput {
  const rawIdentifier = String(identifier == null ? "" : identifier).trim();
  const normalizedAttribute = normalizeAttribute(attribute);
  const attributeRequest = parseAttributeRequest(normalizedAttribute);
  const parsedIdentifier = parseTickerRequest(rawIdentifier);
  const requestTicker = parsedIdentifier.ticker;

  return new RequestInput({
    attribute: normalizedAttribute,
    attributeRequest,
    attributeType: attributeRequest.baseAttribute === "isin" ? "isin" : "quote",
    fxPair: parseFxTicker(requestTicker),
    identifier: rawIdentifier,
    infoMode: parsedIdentifier.infoMode,
    ticker: requestTicker,
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
  );

  return buildTypedRequestFromParsedInput(
    originalInput,
    parsedResolvedInput,
    identifierResolutionMs,
    resolvedDeps,
  );
}
