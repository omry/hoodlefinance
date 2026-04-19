import {
  EquityRequest,
  FxRequest,
  RequestInput,
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

export function extractIsinFromRequestInput(
  input: Pick<RequestInput, "ticker">,
  isIsin?: (value: string) => boolean,
): string {
  const resolvedLooksLikeIsin = isIsin || looksLikeIsin;
  const ticker = String(input.ticker || "").trim();
  const upperTicker = ticker.toUpperCase();

  if (resolvedLooksLikeIsin(ticker)) {
    return upperTicker;
  }

  return upperTicker.startsWith("ISIN:") ? upperTicker.slice(5).trim() : "";
}

export function extractIsinCountryCode(
  input: Pick<RequestInput, "ticker">,
  isIsin?: (value: string) => boolean,
): string {
  const isin = extractIsinFromRequestInput(input, isIsin);

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
): ResolvedRequest {
  const resolvedTicker = String(parsedInput.ticker || "").trim();
  const fxPair = parsedInput.fxPair || parseFxTicker(resolvedTicker);
  const explicitExchange = extractTickerExchange(resolvedTicker);
  const yahooExchangeFromResolvedTicker =
    extractYahooExchangeFromSymbol(resolvedTicker);

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

  const normalizedYahooTicker = normalizeTickerWithoutIsin(resolvedTicker);
  const yahooExchange = extractYahooExchangeFromSymbol(normalizedYahooTicker);
  const symbol = explicitExchange
    ? String(resolvedTicker).split(":").slice(1).join(":").trim().toUpperCase()
    : normalizedYahooTicker;

  return new EquityRequest({
    allowTradingviewFallback: looksLikeIsraeliFundYahooSymbol(
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
): ResolvedRequest {
  const parsedResolvedInput = createRequestInput(
    resolvedTicker,
    originalInput.attribute,
  );

  return buildTypedRequestFromParsedInput(
    originalInput,
    parsedResolvedInput,
    identifierResolutionMs,
  );
}
