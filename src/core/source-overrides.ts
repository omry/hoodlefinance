import { parseTickerRequest } from "./request-parsing";

export function isDefaultSourceOverrideName(_source: string): boolean {
  return false;
}

export function stripDefaultTickerSourceOverride(ticker: string): string {
  return parseTickerRequest(ticker, isDefaultSourceOverrideName).ticker;
}
