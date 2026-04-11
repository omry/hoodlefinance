import type { AttributeRequest, ParsedTickerRequest } from "./request";


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
      ticker: candidateTicker,
    };
  }

  if (candidateTicker && candidateSource) {
    return {
      infoMode: "source-override",
      ticker: candidateTicker,
    };
  }

  if (candidateTicker) {
    return {
      infoMode: "source-list",
      ticker: candidateTicker,
    };
  }

  return {
    infoMode: "",
    ticker: value,
  };
}

export function stripTickerSourceOverride(
  ticker: unknown,
): string {
  return parseTickerRequest(ticker).ticker;
}

export function extractTickerSourceOverride(ticker: unknown): string {
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

  return candidateTicker && candidateSource && candidateSource !== "?"
    ? candidateSource
    : "";
}

export function extractTickerInfoMode(
  ticker: unknown,
): ParsedTickerRequest["infoMode"] {
  return parseTickerRequest(ticker).infoMode;
}
