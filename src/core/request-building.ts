import {
  EquityRequest,
  FxRequest,
  RequestInput,
  type AttributeRequest,
  type FxPair,
  type ParsedTickerRequest,
  type RequestClassification,
  type RequestInputInit,
  type ResolvedRequest,
} from "./request";

export interface RequestBuildingDependencies {
  extractTickerExchange(ticker: string): string;
  extractYahooExchangeFromSymbol(symbol: string): string;
  isPseTicker(ticker: string): boolean;
  isPseYahooSymbol(ticker: string): boolean;
  looksLikeIsraeliFundYahooSymbol(symbol: string): boolean;
  looksLikeIsin(value: string): boolean;
  normalizeAttribute(attribute: unknown): string;
  normalizeTickerWithoutIsin(ticker: string): string;
  parseAttributeRequest(attribute: string): AttributeRequest;
  parseFxTicker(ticker: string): FxPair | null;
  parsePseSymbol(ticker: string): string;
  parsePseYahooSymbol(ticker: string): string;
  parseTickerRequest(ticker: string): ParsedTickerRequest;
}

export function extractIsinFromRequestInput(
  input: Pick<RequestInput, "ticker" | "upperTicker">,
  looksLikeIsin: (value: string) => boolean,
): string {
  const ticker = String(input.ticker || "").trim();
  const upperTicker = String(input.upperTicker || "").trim();

  if (looksLikeIsin(ticker)) {
    return upperTicker;
  }

  return upperTicker.startsWith("ISIN:") ? upperTicker.slice(5).trim() : "";
}

export function classifyRequestInput(
  input: Pick<RequestInput, "fxPair" | "ticker" | "upperTicker">,
  looksLikeIsin: (value: string) => boolean,
): RequestClassification {
  if (extractIsinFromRequestInput(input, looksLikeIsin)) {
    return "isin";
  }

  if (input.fxPair) {
    return "fx";
  }

  return "equity";
}

export function createRequestInput(
  identifier: unknown,
  attribute: unknown,
  deps: RequestBuildingDependencies,
): RequestInput {
  const rawIdentifier = String(identifier == null ? "" : identifier).trim();
  const normalizedAttribute = deps.normalizeAttribute(attribute);
  const attributeRequest = deps.parseAttributeRequest(normalizedAttribute);
  const parsedIdentifier = deps.parseTickerRequest(rawIdentifier);
  const requestTicker = parsedIdentifier.ticker;
  const draftInput: Omit<RequestInputInit, "classification"> = {
    attribute: normalizedAttribute,
    attributeRequest,
    attributeType: attributeRequest.baseAttribute === "isin" ? "isin" : "quote",
    fxPair: deps.parseFxTicker(requestTicker),
    identifier: rawIdentifier,
    infoMode: parsedIdentifier.infoMode,
    sourceOverride: parsedIdentifier.sourceOverride,
    ticker: requestTicker,
    upperTicker: requestTicker.toUpperCase(),
  };

  return new RequestInput({
    ...draftInput,
    classification: classifyRequestInput(draftInput, deps.looksLikeIsin),
  });
}

export function buildTypedRequestFromParsedInput(
  originalInput: Pick<RequestInput, "attribute" | "identifier">,
  parsedInput: Pick<RequestInput, "fxPair" | "ticker">,
  identifierResolutionMs: number,
  deps: RequestBuildingDependencies,
): ResolvedRequest {
  const resolvedTicker = String(parsedInput.ticker || "").trim();
  const fxPair = parsedInput.fxPair || deps.parseFxTicker(resolvedTicker);

  if (deps.isPseTicker(resolvedTicker)) {
    const symbol = deps.parsePseSymbol(resolvedTicker);

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

  if (deps.isPseYahooSymbol(resolvedTicker)) {
    const symbol = deps.parsePseYahooSymbol(resolvedTicker);

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

  const normalizedYahooTicker = deps.normalizeTickerWithoutIsin(resolvedTicker);
  const explicitExchange = deps.extractTickerExchange(resolvedTicker);
  const yahooExchange = deps.extractYahooExchangeFromSymbol(
    normalizedYahooTicker,
  );
  const symbol = explicitExchange
    ? String(resolvedTicker).split(":").slice(1).join(":").trim().toUpperCase()
    : normalizedYahooTicker;

  return new EquityRequest({
    allowTradingviewFallback: deps.looksLikeIsraeliFundYahooSymbol(
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
  deps: RequestBuildingDependencies,
): ResolvedRequest {
  const parsedResolvedInput = createRequestInput(
    resolvedTicker,
    originalInput.attribute,
    deps,
  );

  return buildTypedRequestFromParsedInput(
    originalInput,
    parsedResolvedInput,
    identifierResolutionMs,
    deps,
  );
}
