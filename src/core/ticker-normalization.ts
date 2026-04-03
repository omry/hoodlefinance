import {
  isPrefixlessExchange,
  normalizeExchangeSymbol,
  normalizeExplicitIbkrExchange,
  normalizeYahooStyleIsraeliFundTicker,
  resolveExchangeSuffix,
} from "./exchange-symbols";
import { parseFxTicker } from "./fx-normalization";
import { stripDefaultTickerSourceOverride } from "./source-overrides";

export function normalizeTickerWithoutIsin(ticker: string): string {
  const value = String(stripDefaultTickerSourceOverride(ticker) || "").trim();
  const fxPair = parseFxTicker(value);
  const parts = value.split(":");

  if (fxPair) {
    return fxPair.yahooChartSymbol;
  }

  if (parts.length < 2) {
    return normalizeYahooStyleIsraeliFundTicker(value);
  }

  const exchange = (parts[0] || "").trim().toUpperCase();
  const symbol = parts.slice(1).join(":").trim();

  if (!symbol) {
    throw new Error(`Ticker "${ticker}" is invalid.`);
  }

  if (isPrefixlessExchange(exchange)) {
    return symbol;
  }

  const exchangeSuffix = resolveExchangeSuffix(exchange);
  if (exchangeSuffix) {
    return `${normalizeExchangeSymbol(exchange, symbol)}${exchangeSuffix}`;
  }

  if (normalizeExplicitIbkrExchange(exchange)) {
    return symbol;
  }

  throw new Error(
    `Unsupported exchange prefix "${exchange}" in ticker "${ticker}".`,
  );
}
