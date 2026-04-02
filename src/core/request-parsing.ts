import type { AttributeRequest, ParsedTickerRequest } from "./request";

export type SourceOverrideNamePredicate = (candidateSource: string) => boolean;

export function normalizeAttribute(attribute: unknown): string {
  const normalizedAttribute = String(
    attribute == null ? "price" : attribute,
  ).trim();

  return normalizedAttribute ? normalizedAttribute : "price";
}

export function parseAttributeRequest(attribute: unknown): AttributeRequest {
  const rawAttribute = normalizeAttribute(attribute);
  const match = /^([^@]+?)(?:@([^@]+))?$/.exec(rawAttribute);
  const baseAttribute = match?.[1]?.trim() || "";
  const outputCode = match?.[2]?.trim() || "";

  if (!baseAttribute || (rawAttribute.includes("@") && !outputCode)) {
    throw new Error("Converted attributes must look like price@USD.");
  }

  return {
    baseAttribute: baseAttribute.toLowerCase(),
    outputCode,
    rawAttribute,
    wantsOutputCurrency: outputCode !== "",
  };
}

export function parseTickerRequest(
  ticker: unknown,
  isSourceOverrideName: SourceOverrideNamePredicate,
): ParsedTickerRequest {
  const value = String(ticker == null ? "" : ticker).trim();
  const atIndex = value.lastIndexOf("@");
  const candidateTicker = atIndex > 0 ? value.slice(0, atIndex).trim() : "";
  const candidateSource =
    atIndex > 0
      ? value
          .slice(atIndex + 1)
          .trim()
          .toUpperCase()
      : "";

  if (candidateTicker && candidateSource === "?") {
    return {
      infoMode: "source-name",
      sourceOverride: "",
      ticker: candidateTicker,
    };
  }

  if (candidateTicker && isSourceOverrideName(candidateSource)) {
    return {
      infoMode: "",
      sourceOverride: candidateSource,
      ticker: candidateTicker,
    };
  }

  if (candidateTicker) {
    return {
      infoMode: "source-list",
      sourceOverride: "",
      ticker: candidateTicker,
    };
  }

  return {
    infoMode: "",
    sourceOverride: "",
    ticker: value,
  };
}

export function stripTickerSourceOverride(
  ticker: unknown,
  isSourceOverrideName: SourceOverrideNamePredicate,
): string {
  return parseTickerRequest(ticker, isSourceOverrideName).ticker;
}

export function extractTickerSourceOverride(
  ticker: unknown,
  isSourceOverrideName: SourceOverrideNamePredicate,
): string {
  return parseTickerRequest(ticker, isSourceOverrideName).sourceOverride;
}

export function extractTickerInfoMode(
  ticker: unknown,
  isSourceOverrideName: SourceOverrideNamePredicate,
): ParsedTickerRequest["infoMode"] {
  return parseTickerRequest(ticker, isSourceOverrideName).infoMode;
}
