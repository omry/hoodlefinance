import type { FxPair, RequestInput, ResolvedRequest } from "./request";

export interface PseQuoteRouteState extends Record<string, unknown> {
  symbol: string;
}

export interface IsinIdentifierRouteState extends Record<string, unknown> {
  input: RequestInput;
  isin: string;
}

export interface FxQuoteRouteState extends Record<string, unknown> {
  fxPair: FxPair;
}

export interface EquityYahooQuoteRouteState extends Record<string, unknown> {
  fxPair: null;
  preferredYahooSymbol: string;
  yahooSymbol: string;
}

export function buildPseQuoteRouteState(
  request: Pick<Extract<ResolvedRequest, { requestType: "equity" }>, "symbol">,
): PseQuoteRouteState {
  return { symbol: request.symbol };
}

export function buildIsinIdentifierRouteState(
  request: RequestInput,
  extractIsinFromRequestInput: (input: RequestInput) => string,
): IsinIdentifierRouteState {
  return {
    input: request,
    isin: extractIsinFromRequestInput(request),
  };
}

export function buildFxQuoteRouteState(
  request: Pick<Extract<ResolvedRequest, { requestType: "fx" }>, "fxPair">,
): FxQuoteRouteState {
  return { fxPair: request.fxPair };
}

export function buildEquityYahooQuoteRouteState(
  request: Pick<
    Extract<ResolvedRequest, { requestType: "equity" }>,
    "yahooSymbol"
  >,
  preferredYahooSymbol = "",
): EquityYahooQuoteRouteState {
  return {
    fxPair: null,
    yahooSymbol: request.yahooSymbol,
    preferredYahooSymbol: String(preferredYahooSymbol || ""),
  };
}
