function normalizeNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function objectFromPresentEntries(
  entries: Array<readonly [string, unknown]>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    if (value != null && value !== "") {
      result[key] = value;
    }
  }

  return result;
}

export interface StockQuoteInit {
  currency?: string | null | undefined;
  displayName?: string | null | undefined;
  exchangeDataDelayedBy?: number | null | undefined;
  exchangeName?: string | null | undefined;
  financialCurrency?: string | null | undefined;
  fullExchangeName?: string | null | undefined;
  fxUnitScale?: number | null | undefined;
  isin?: string | null | undefined;
  longName?: string | null | undefined;
  quoteSourceName?: string | null | undefined;
  regularMarketDayHigh?: number | null | undefined;
  regularMarketDayLow?: number | null | undefined;
  regularMarketPreviousClose?: number | null | undefined;
  regularMarketPrice?: number | null | undefined;
  regularMarketTime?: number | null | undefined;
  regularMarketVolume?: number | null | undefined;
  shortName?: string | null | undefined;
  symbol: string;
}

export class StockQuote {
  readonly symbol: string;
  readonly currency: string;
  readonly financialCurrency: string | undefined;
  readonly longName: string | undefined;
  readonly shortName: string | undefined;
  readonly displayName: string | undefined;
  readonly isin: string | undefined;
  readonly regularMarketPrice: number | undefined;
  readonly regularMarketPreviousClose: number | undefined;
  readonly regularMarketDayHigh: number | undefined;
  readonly regularMarketDayLow: number | undefined;
  readonly regularMarketVolume: number | undefined;
  readonly regularMarketTime: number | undefined;
  readonly exchangeDataDelayedBy: number | undefined;
  readonly exchangeName: string | undefined;
  readonly fullExchangeName: string | undefined;
  readonly quoteSourceName: string | undefined;
  readonly fxUnitScale: number | undefined;

  constructor(fields: StockQuoteInit) {
    this.symbol = String(fields.symbol || "");
    this.currency = String(fields.currency || fields.financialCurrency || "");
    this.financialCurrency = fields.financialCurrency
      ? String(fields.financialCurrency)
      : this.currency || undefined;
    this.longName = fields.longName ?? undefined;
    this.shortName = fields.shortName ?? undefined;
    this.displayName = fields.displayName ?? undefined;
    this.isin = fields.isin ?? undefined;
    this.regularMarketPrice = normalizeNumber(fields.regularMarketPrice);
    this.regularMarketPreviousClose = normalizeNumber(
      fields.regularMarketPreviousClose,
    );
    this.regularMarketDayHigh = normalizeNumber(fields.regularMarketDayHigh);
    this.regularMarketDayLow = normalizeNumber(fields.regularMarketDayLow);
    this.regularMarketVolume = normalizeNumber(fields.regularMarketVolume);
    this.regularMarketTime = normalizeNumber(fields.regularMarketTime);
    this.exchangeDataDelayedBy = normalizeNumber(fields.exchangeDataDelayedBy);
    this.exchangeName = fields.exchangeName ?? undefined;
    this.fullExchangeName = fields.fullExchangeName ?? undefined;
    this.quoteSourceName = fields.quoteSourceName ?? undefined;
    this.fxUnitScale = normalizeNumber(fields.fxUnitScale);
  }

  toJSON(): Record<string, unknown> {
    return objectFromPresentEntries(Object.entries(this));
  }

  static fromJSON(value: unknown): StockQuote {
    return new StockQuote((value || {}) as never);
  }
}

export interface FxQuoteInit {
  currency?: string | null | undefined;
  exchangeDataDelayedBy?: number | null | undefined;
  financialCurrency?: string | null | undefined;
  fxUnitScale?: number | null | undefined;
  googleSymbol?: string | null | undefined;
  regularMarketPreviousClose?: number | null | undefined;
  regularMarketPrice?: number | null | undefined;
  regularMarketTime?: number | null | undefined;
  shortName?: string | null | undefined;
  symbol: string;
}

export class FxQuote {
  readonly symbol: string;
  readonly currency: string;
  readonly shortName: string;
  readonly googleSymbol: string;
  readonly fxUnitScale: number;
  readonly regularMarketPrice: number | undefined;
  readonly regularMarketPreviousClose: number | undefined;
  readonly regularMarketTime: number | undefined;
  readonly exchangeDataDelayedBy: number | undefined;

  constructor(fields: FxQuoteInit) {
    this.symbol = String(fields.symbol || "");
    this.currency = String(fields.currency || fields.financialCurrency || "");
    this.shortName = String(fields.shortName || "");
    this.googleSymbol = String(fields.googleSymbol || "");
    this.fxUnitScale = normalizeNumber(fields.fxUnitScale) ?? 1;
    this.regularMarketPrice = normalizeNumber(fields.regularMarketPrice);
    this.regularMarketPreviousClose = normalizeNumber(
      fields.regularMarketPreviousClose,
    );
    this.regularMarketTime = normalizeNumber(fields.regularMarketTime);
    this.exchangeDataDelayedBy = normalizeNumber(fields.exchangeDataDelayedBy);
  }

  toJSON(): Record<string, unknown> {
    return objectFromPresentEntries(Object.entries(this));
  }

  static fromJSON(value: unknown): FxQuote {
    return new FxQuote((value || {}) as never);
  }
}
