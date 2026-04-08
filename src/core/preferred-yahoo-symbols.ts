function normalizePreferredTickerKey(ticker: string): string {
  const match = String(ticker || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+)-([A-Z])$/);

  return match ? `${match[1]}-${match[2]}` : "";
}

function buildPreferredFallbackSymbol(ticker: string): string {
  const normalized = normalizePreferredTickerKey(ticker);

  return normalized ? normalized.replace(/-([A-Z])$/, "-P$1") : "";
}

export function parsePreferredReitTickerSet(text: string): Set<string> {
  let payload: Record<string, unknown> | null = null;

  try {
    payload = JSON.parse(String(text || "")) as Record<string, unknown>;
  } catch {
    return new Set();
  }

  const entries = Array.isArray(payload?.preferredTickers)
    ? payload.preferredTickers
    : [];
  const normalizedSet = new Set<string>();

  for (const entry of entries) {
    const normalized = String(entry || "")
      .trim()
      .toUpperCase();
    const parts = normalized.split(/\s+/);

    if (
      parts.length === 2 &&
      /^[A-Z0-9]+$/.test(parts[0] || "") &&
      /^[A-Z]$/.test(parts[1] || "")
    ) {
      normalizedSet.add(`${parts[0]}-${parts[1]}`);
    }
  }

  return normalizedSet;
}

export function createPreferredYahooSymbolResolver(
  preferredTickerSet: ReadonlySet<string>,
): (ticker: string) => string {
  return function resolvePreferredYahooSymbol(ticker: string): string {
    const normalizedKey = normalizePreferredTickerKey(ticker);

    if (!normalizedKey || !preferredTickerSet.has(normalizedKey)) {
      return "";
    }

    return buildPreferredFallbackSymbol(ticker);
  };
}
