function normalizeCurrencyCode(currency: unknown): string {
  if (currency === "GBp") return "GBP";
  if (currency === "ILA") return "ILS";
  return String(currency || "");
}

function normalizeNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function scaleMoney(value: unknown, scale: number): number | undefined {
  const numericValue = normalizeNumber(value);
  return numericValue == null ? undefined : numericValue * scale;
}

export interface StockQuoteInit {
  chartPreviousClose?: number | null | undefined;
  currency?: string | null | undefined;
  displayName?: string | null | undefined;
  exchangeDataDelayedBy?: number | null | undefined;
  exchangeName?: string | null | undefined;
  financialCurrency?: string | null | undefined;
  fullExchangeName?: string | null | undefined;
  fxUnitScale?: number | null | undefined;
  isin?: string | null | undefined;
  longName?: string | null | undefined;
  postMarketPrice?: number | null | undefined;
  postMarketTime?: number | null | undefined;
  preMarketPrice?: number | null | undefined;
  preMarketTime?: number | null | undefined;
  previousClose?: number | null | undefined;
  quoteSourceName?: string | null | undefined;
  regularMarketChange?: number | null | undefined;
  regularMarketChangePercent?: number | null | undefined;
  regularMarketDayHigh?: number | null | undefined;
  regularMarketDayLow?: number | null | undefined;
  regularMarketOpen?: number | null | undefined;
  regularMarketPreviousClose?: number | null | undefined;
  regularMarketPrice?: number | null | undefined;
  regularMarketTime?: number | null | undefined;
  regularMarketVolume?: number | null | undefined;
  shortName?: string | null | undefined;
  symbol: string;
}

export class StockQuote {
  private readonly rawQuoteSnapshot: Record<string, unknown>;

  readonly symbol: string;
  readonly currency: string;
  readonly financialCurrency: string | undefined;
  readonly longName: string | undefined;
  readonly shortName: string | undefined;
  readonly displayName: string | undefined;
  readonly isin: string | undefined;
  readonly regularMarketPrice: number | undefined;
  readonly postMarketPrice: number | undefined;
  readonly preMarketPrice: number | undefined;
  readonly regularMarketPreviousClose: number | undefined;
  readonly previousClose: number | undefined;
  readonly chartPreviousClose: number | undefined;
  readonly regularMarketDayHigh: number | undefined;
  readonly regularMarketDayLow: number | undefined;
  readonly regularMarketOpen: number | undefined;
  readonly regularMarketChange: number | undefined;
  readonly regularMarketChangePercent: number | undefined;
  readonly regularMarketVolume: number | undefined;
  readonly regularMarketTime: number | undefined;
  readonly postMarketTime: number | undefined;
  readonly preMarketTime: number | undefined;
  readonly exchangeDataDelayedBy: number | undefined;
  readonly exchangeName: string | undefined;
  readonly fullExchangeName: string | undefined;
  readonly quoteSourceName: string | undefined;
  readonly fxUnitScale: number | undefined;

  get rawQuote(): Record<string, unknown> {
    return this.rawQuoteSnapshot;
  }

  constructor(fields: StockQuoteInit) {
    const rawCurrency = fields.currency || fields.financialCurrency || "";
    const moneyScale =
      fields.currency === "GBp" || fields.financialCurrency === "GBp"
        ? 0.01
        : fields.currency === "ILA" || fields.financialCurrency === "ILA"
          ? 0.01
          : 1;

    this.symbol = String(fields.symbol || "");
    this.currency = normalizeCurrencyCode(rawCurrency);
    this.financialCurrency = normalizeCurrencyCode(
      fields.financialCurrency || rawCurrency,
    );
    this.longName = fields.longName ?? undefined;
    this.shortName = fields.shortName ?? undefined;
    this.displayName = fields.displayName ?? undefined;
    this.isin = fields.isin ?? undefined;
    this.regularMarketPrice = scaleMoney(fields.regularMarketPrice, moneyScale);
    this.postMarketPrice = scaleMoney(fields.postMarketPrice, moneyScale);
    this.preMarketPrice = scaleMoney(fields.preMarketPrice, moneyScale);
    this.regularMarketPreviousClose = scaleMoney(fields.regularMarketPreviousClose, moneyScale);
    this.previousClose = scaleMoney(fields.previousClose, moneyScale);
    this.chartPreviousClose = scaleMoney(fields.chartPreviousClose, moneyScale);
    this.regularMarketDayHigh = scaleMoney(fields.regularMarketDayHigh, moneyScale);
    this.regularMarketDayLow = scaleMoney(fields.regularMarketDayLow, moneyScale);
    this.regularMarketOpen = scaleMoney(fields.regularMarketOpen, moneyScale);
    this.regularMarketChange = scaleMoney(fields.regularMarketChange, moneyScale);
    this.regularMarketChangePercent = fields.regularMarketChangePercent ?? undefined;
    this.regularMarketVolume = normalizeNumber(fields.regularMarketVolume);
    this.regularMarketTime = normalizeNumber(fields.regularMarketTime);
    this.postMarketTime = normalizeNumber(fields.postMarketTime);
    this.preMarketTime = normalizeNumber(fields.preMarketTime);
    this.exchangeDataDelayedBy = normalizeNumber(fields.exchangeDataDelayedBy);
    this.exchangeName = fields.exchangeName ?? undefined;
    this.fullExchangeName = fields.fullExchangeName ?? undefined;
    this.quoteSourceName = fields.quoteSourceName ?? undefined;
    this.fxUnitScale = normalizeNumber(fields.fxUnitScale);

    this.rawQuoteSnapshot = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value != null),
    );
  }
}

export interface FxQuoteInit {
  currency?: string | null | undefined;
  exchangeDataDelayedBy?: number | null | undefined;
  fxUnitScale?: number | null | undefined;
  googleSymbol?: string | null | undefined;
  previousClose?: number | null | undefined;
  regularMarketPreviousClose?: number | null | undefined;
  regularMarketPrice?: number | null | undefined;
  regularMarketTime?: number | null | undefined;
  shortName?: string | null | undefined;
  symbol: string;
}

export class FxQuote {
  private readonly rawQuoteSnapshot: Record<string, unknown>;

  readonly symbol: string;
  readonly currency: string;
  readonly shortName: string;
  readonly googleSymbol: string;
  readonly fxUnitScale: number;
  readonly regularMarketPrice: number | undefined;
  readonly regularMarketPreviousClose: number | undefined;
  readonly previousClose: number | undefined;
  readonly regularMarketTime: number | undefined;
  readonly exchangeDataDelayedBy: number | undefined;

  get rawQuote(): Record<string, unknown> {
    return this.rawQuoteSnapshot;
  }

  constructor(fields: FxQuoteInit) {
    this.symbol = String(fields.symbol || "");
    this.currency = normalizeCurrencyCode(fields.currency || "");
    this.shortName = String(fields.shortName || "");
    this.googleSymbol = String(fields.googleSymbol || "");
    this.fxUnitScale = normalizeNumber(fields.fxUnitScale) ?? 1;
    this.regularMarketPrice = normalizeNumber(fields.regularMarketPrice);
    this.regularMarketPreviousClose = normalizeNumber(fields.regularMarketPreviousClose);
    this.previousClose = normalizeNumber(fields.previousClose);
    this.regularMarketTime = normalizeNumber(fields.regularMarketTime);
    this.exchangeDataDelayedBy = normalizeNumber(fields.exchangeDataDelayedBy);

    this.rawQuoteSnapshot = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value != null),
    );
  }
}
