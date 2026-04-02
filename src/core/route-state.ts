import type { FxPair, ResolvedRequest } from "./request";

export interface PseQuoteRouteState {
  symbol: string;
}

export interface FxQuoteRouteState {
  fxPair: FxPair;
}

export interface EquityYahooQuoteRouteState {
  fxPair: null;
  preferredYahooSymbol: string;
  yahooSymbol: string;
}

export function buildPseQuoteRouteState(
  request: Pick<Extract<ResolvedRequest, { requestType: "equity" }>, "symbol">,
): PseQuoteRouteState {
  return { symbol: request.symbol };
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
  resolvePreferredYahooSymbol?: ((symbol: string) => string) | null,
): EquityYahooQuoteRouteState {
  return {
    fxPair: null,
    yahooSymbol: request.yahooSymbol,
    preferredYahooSymbol:
      typeof resolvePreferredYahooSymbol === "function"
        ? resolvePreferredYahooSymbol(request.yahooSymbol)
        : "",
  };
}
