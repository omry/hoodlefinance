import { parseTickerRequest } from "./request-parsing";
import { PLAN_SPECS_BY_CODE, RESOLVER_SPECS_BY_CODE } from "./spec-data";

export function buildSourceOverrideNameSet(): Set<string> {
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

export function isDefaultSourceOverrideName(source: string): boolean {
  return DEFAULT_SOURCE_OVERRIDE_NAMES.has(
    String(source || "")
      .trim()
      .toUpperCase(),
  );
}

export function stripDefaultTickerSourceOverride(ticker: string): string {
  return parseTickerRequest(ticker, isDefaultSourceOverrideName).ticker;
}
