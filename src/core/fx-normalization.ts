import type { FxPair } from "./request";

declare function require(path: string): unknown;

interface CurrencyCodeAliasEntry {
  canonicalCode?: string;
  factor?: number;
}

interface CurrencyCodePayload {
  aliases?: Record<string, CurrencyCodeAliasEntry>;
  canonicalCodes?: string[];
  cryptoCodes?: string[];
}

interface CurrencyUnit {
  assetClass: "currency" | "crypto";
  canonicalCode: string;
  displayCode: string;
  factor: number;
}

function buildDefaultCurrencyUnits(
  payload: CurrencyCodePayload,
): Record<string, CurrencyUnit> {
  const unitsByCode: Record<string, CurrencyUnit> = {};
  const aliasPayload =
    payload && payload.aliases && typeof payload.aliases === "object"
      ? payload.aliases
      : {};
  const cryptoCodeList = Array.isArray(payload?.cryptoCodes)
    ? payload.cryptoCodes
    : [];
  const canonicalCodeList = Array.isArray(payload?.canonicalCodes)
    ? payload.canonicalCodes
    : [];

  for (const code of canonicalCodeList) {
    const canonicalCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3}$/.test(canonicalCode)) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "currency",
      canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  for (const code of cryptoCodeList) {
    const canonicalCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3,4}$/.test(canonicalCode) || unitsByCode[canonicalCode]) {
      continue;
    }

    unitsByCode[canonicalCode] = {
      assetClass: "crypto",
      canonicalCode,
      displayCode: canonicalCode,
      factor: 1,
    };
  }

  for (const aliasCode of Object.keys(aliasPayload)) {
    const aliasEntry = aliasPayload[aliasCode] || {};
    const normalizedAliasCode = String(aliasCode || "").trim();
    const aliasCanonicalCode = String(aliasEntry.canonicalCode || "")
      .trim()
      .toUpperCase();
    const factor = Number(aliasEntry.factor);

    if (
      !/^[A-Za-z]{3,4}$/.test(normalizedAliasCode) ||
      !unitsByCode[aliasCanonicalCode] ||
      !isFinite(factor) ||
      factor <= 0
    ) {
      continue;
    }

    unitsByCode[normalizedAliasCode] = {
      assetClass: unitsByCode[aliasCanonicalCode]?.assetClass || "currency",
      canonicalCode: aliasCanonicalCode,
      displayCode: normalizedAliasCode,
      factor,
    };

    const upperAliasCode = normalizedAliasCode.toUpperCase();

    if (!unitsByCode[upperAliasCode]) {
      unitsByCode[upperAliasCode] = unitsByCode[normalizedAliasCode];
    }
  }

  return unitsByCode;
}

const DEFAULT_CURRENCY_UNITS = buildDefaultCurrencyUnits(
  require("../../../data/currency-codes.json") as CurrencyCodePayload,
);

function buildFxPair(baseCode: string, quoteCode: string): FxPair {
  const baseUnit = DEFAULT_CURRENCY_UNITS[String(baseCode || "").trim()];
  const quoteUnit = DEFAULT_CURRENCY_UNITS[String(quoteCode || "").trim()];

  if (!baseUnit || !quoteUnit) {
    throw new Error(
      "Currency ticker must use supported 3- or 4-character currency codes.",
    );
  }

  const hasCrypto =
    baseUnit.assetClass === "crypto" || quoteUnit.assetClass === "crypto";
  const canonicalPair = baseUnit.canonicalCode + quoteUnit.canonicalCode;

  return {
    baseCanonicalCode: baseUnit.canonicalCode,
    baseDisplayCode: baseUnit.displayCode,
    canonicalPair,
    displayQuoteCode: quoteUnit.displayCode,
    googlePairSlug: `${baseUnit.canonicalCode}-${quoteUnit.canonicalCode}`,
    googleSymbol:
      baseUnit.displayCode.length === 3 && quoteUnit.displayCode.length === 3
        ? `CURRENCY:${baseUnit.displayCode}${quoteUnit.displayCode}`
        : `CURRENCY:${baseUnit.displayCode}.${quoteUnit.displayCode}`,
    isSameCurrency: baseUnit.canonicalCode === quoteUnit.canonicalCode,
    pairDisplay: `${baseUnit.displayCode}${quoteUnit.displayCode}`,
    quoteCanonicalCode: quoteUnit.canonicalCode,
    quoteDisplayCode: quoteUnit.displayCode,
    scale: baseUnit.factor / quoteUnit.factor,
    yahooChartSymbol: hasCrypto
      ? `${baseUnit.canonicalCode}-${quoteUnit.canonicalCode}`
      : `${canonicalPair}=X`,
    yahooSymbol: `${canonicalPair}=X`,
  };
}

function findCompactFxPairCandidates(pairText: string): FxPair[] {
  const candidates: FxPair[] = [];

  for (let baseLength = 3; baseLength <= 4; baseLength += 1) {
    const quoteLength = pairText.length - baseLength;

    if (quoteLength < 3 || quoteLength > 4) {
      continue;
    }

    const baseCode = pairText.slice(0, baseLength);
    const quoteCode = pairText.slice(baseLength);

    if (!/^[A-Za-z]{3,4}$/.test(baseCode) || !/^[A-Za-z]{3,4}$/.test(quoteCode)) {
      continue;
    }

    if (!DEFAULT_CURRENCY_UNITS[baseCode] || !DEFAULT_CURRENCY_UNITS[quoteCode]) {
      continue;
    }

    candidates.push(buildFxPair(baseCode, quoteCode));
  }

  return candidates;
}

export function parseFxTicker(ticker: string): FxPair | null {
  const value = String(ticker || "").trim();
  const explicitMatch = value.match(/^([^:]+):(.*)$/);
  const exchange = explicitMatch?.[1]?.trim().toUpperCase() || "";
  const pairText = explicitMatch?.[2]?.trim() || value;
  const dottedMatch = explicitMatch
    ? pairText.match(/^([A-Za-z]{3,4})\.([A-Za-z]{3,4})$/)
    : null;
  const looksLikeCompactPair = /^[A-Za-z]{6,8}$/.test(pairText);
  const compactCandidates = looksLikeCompactPair
    ? findCompactFxPairCandidates(pairText)
    : [];

  if (explicitMatch && exchange !== "CURRENCY") {
    return null;
  }

  if (dottedMatch) {
    const baseCode = dottedMatch[1] || "";
    const quoteCode = dottedMatch[2] || "";

    if (!DEFAULT_CURRENCY_UNITS[baseCode] || !DEFAULT_CURRENCY_UNITS[quoteCode]) {
      throw new Error(
        `Currency ticker "${ticker}" must use supported 3- or 4-character currency codes.`,
      );
    }

    return buildFxPair(baseCode, quoteCode);
  }

  if (explicitMatch && !looksLikeCompactPair) {
    throw new Error(
      `Currency ticker "${ticker}" must look like CURRENCY:USDEUR or CURRENCY:USDT.USD.`,
    );
  }

  if (!looksLikeCompactPair || compactCandidates.length !== 1) {
    if (explicitMatch && !compactCandidates.length) {
      throw new Error(
        `Currency ticker "${ticker}" must use supported 3- or 4-character currency codes.`,
      );
    }

    return null;
  }

  return compactCandidates[0] || null;
}
