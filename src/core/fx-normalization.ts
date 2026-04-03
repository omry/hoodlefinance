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

export interface CurrencyCodeDataPayload {
  aliases?: Record<string, CurrencyCodeAliasEntry>;
  canonicalCodes?: string[];
  cryptoCodes?: string[];
}

export function buildCurrencyUnits(
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

export function parseCurrencyCodeDataResource(
  sourceText: string,
): Record<string, CurrencyUnit> {
  const payload = JSON.parse(sourceText) as CurrencyCodeDataPayload;
  const unitsByCode: Record<string, CurrencyUnit> = {};
  const aliasPayload =
    payload && payload.aliases && typeof payload.aliases === "object"
      ? payload.aliases
      : {};
  const cryptoCodeList = Array.isArray(payload?.cryptoCodes)
    ? payload.cryptoCodes
    : [];

  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.canonicalCodes)
  ) {
    throw new Error("Currency code data is invalid.");
  }

  for (const code of payload.canonicalCodes) {
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

  if (!Object.keys(unitsByCode).length) {
    throw new Error("No canonical currency codes were found in the downloaded data.");
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
      throw new Error(`Currency alias "${aliasCode}" is invalid.`);
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

function buildFxPairWithUnits(
  baseCode: string,
  quoteCode: string,
  unitsByCode: Record<string, CurrencyUnit>,
): FxPair {
  const baseUnit = unitsByCode[String(baseCode || "").trim()];
  const quoteUnit = unitsByCode[String(quoteCode || "").trim()];

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

function findCompactFxPairCandidatesWithUnits(
  pairText: string,
  unitsByCode: Record<string, CurrencyUnit>,
): FxPair[] {
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

    if (!unitsByCode[baseCode] || !unitsByCode[quoteCode]) {
      continue;
    }

    candidates.push(buildFxPairWithUnits(baseCode, quoteCode, unitsByCode));
  }

  return candidates;
}

export function createFxTickerParser(
  unitsByCode: Record<string, CurrencyUnit>,
): (ticker: string) => FxPair | null {
  return function parseFxTickerWithUnits(ticker: string): FxPair | null {
    const value = String(ticker || "").trim();
    const explicitMatch = value.match(/^([^:]+):(.*)$/);
    const exchange = explicitMatch?.[1]?.trim().toUpperCase() || "";
    const pairText = explicitMatch?.[2]?.trim() || value;
    const dottedMatch = explicitMatch
      ? pairText.match(/^([A-Za-z]{3,4})\.([A-Za-z]{3,4})$/)
      : null;
    const looksLikeCompactPair = /^[A-Za-z]{6,8}$/.test(pairText);
    const compactCandidates = looksLikeCompactPair
      ? findCompactFxPairCandidatesWithUnits(pairText, unitsByCode)
      : [];

    if (explicitMatch && exchange !== "CURRENCY") {
      return null;
    }

    if (dottedMatch) {
      const baseCode = dottedMatch[1] || "";
      const quoteCode = dottedMatch[2] || "";

      if (!unitsByCode[baseCode] || !unitsByCode[quoteCode]) {
        throw new Error(
          `Currency ticker "${ticker}" must use supported 3- or 4-character currency codes.`,
        );
      }

      return buildFxPairWithUnits(baseCode, quoteCode, unitsByCode);
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
  };
}

const DEFAULT_CURRENCY_UNITS = buildCurrencyUnits(
  require("../../../data/currency-codes.json") as CurrencyCodePayload,
);

export const parseFxTicker = createFxTickerParser(DEFAULT_CURRENCY_UNITS);
