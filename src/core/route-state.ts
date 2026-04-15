import type { FxPair, RequestInput, ResolvedRequest } from "./request";

export function buildPseQuoteRouteState(
  request: Pick<Extract<ResolvedRequest, { requestType: "equity" }>, "symbol">,
): { symbol: string } {
  return { symbol: request.symbol };
}

export function buildIsinIdentifierRouteState(
  request: RequestInput,
  extractIsinFromRequestInput: (input: RequestInput) => string,
): { input: RequestInput; isin: string } {
  return {
    input: request,
    isin: extractIsinFromRequestInput(request),
  };
}

export function buildFxQuoteRouteState(
  request: Pick<Extract<ResolvedRequest, { requestType: "fx" }>, "fxPair">,
): { fxPair: FxPair } {
  return { fxPair: request.fxPair };
}

export function buildEquityYahooQuoteRouteState(
  request: Pick<
    Extract<ResolvedRequest, { requestType: "equity" }>,
    "yahooSymbol"
  >,
  preferredYahooSymbol = "",
): { displaySymbol: string; fxPair: null; preferredYahooSymbol: string; yahooSymbol: string } {
  return {
    displaySymbol: preferredYahooSymbol ? request.yahooSymbol : "",
    fxPair: null,
    yahooSymbol: request.yahooSymbol,
    preferredYahooSymbol: String(preferredYahooSymbol || ""),
  };
}
