type AttributeType = "quote" | "isin";

export type RequestClassification = "equity" | "fx" | "isin";

export interface AttributeRequest {
  baseAttribute: string;
  outputCode: string;
  rawAttribute: string;
  wantsOutputCurrency: boolean;
}

export interface FxPair {
  baseCanonicalCode: string;
  baseDisplayCode?: string;
  canonicalPair?: string;
  displayQuoteCode?: string;
  googlePairSlug?: string;
  googleSymbol?: string;
  isSameCurrency?: boolean;
  pairDisplay?: string;
  quoteCanonicalCode: string;
  quoteDisplayCode?: string;
  scale?: number;
  yahooChartSymbol: string;
  yahooSymbol: string;
}

export interface ParsedTickerRequest {
  infoMode: "" | "source-list" | "source-name" | "source-override";
  ticker: string;
}

export interface RequestInputInit {
  attribute: string;
  attributeRequest: AttributeRequest;
  attributeType: AttributeType;
  fxPair: FxPair | null;
  identifier: string;
  infoMode: ParsedTickerRequest["infoMode"];
  ticker: string;
}

export class RawRequestInput {
  readonly attribute: string;
  readonly identifier: string;

  constructor(identifier: unknown, attribute?: unknown) {
    const normalizedAttribute = String(
      attribute == null ? "price" : attribute,
    ).trim();

    this.attribute = normalizedAttribute || "price";
    this.identifier = String(identifier == null ? "" : identifier).trim();
  }
}

export function looksLikeIsin(value: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value || "").trim());
}

export class RequestInput {
  readonly attribute: string;
  readonly attributeRequest: AttributeRequest;
  readonly attributeType: AttributeType;
  readonly fxPair: FxPair | null;
  readonly identifier: string;
  readonly infoMode: ParsedTickerRequest["infoMode"];
  readonly ticker: string;

  constructor(init: RequestInputInit) {
    this.attribute = init.attribute;
    this.attributeRequest = init.attributeRequest;
    this.attributeType = init.attributeType;
    this.fxPair = init.fxPair;
    this.identifier = init.identifier;
    this.infoMode = init.infoMode;
    this.ticker = init.ticker;
  }
}

export class IsinRequest extends RequestInput {
  readonly classification = "isin" as const;
}

interface BaseRequestInputSnapshot {
  attribute: string;
  identifier: string;
}

class BaseRequest {
  identifierResolutionMs: number;
  readonly input: BaseRequestInputSnapshot;

  constructor(input: BaseRequestInputSnapshot, identifierResolutionMs = 0) {
    this.identifierResolutionMs =
      identifierResolutionMs != null && isFinite(identifierResolutionMs)
        ? Math.max(0, Number(identifierResolutionMs))
        : 0;
    this.input = {
      attribute: input.attribute,
      identifier: input.identifier,
    };
  }
}

export class EquityRequest extends BaseRequest {
  readonly allowTradingviewFallback: boolean;
  readonly classification = "equity";
  readonly exchange: string;
  readonly requestType = "equity";
  readonly symbol: string;
  readonly yahooSymbol: string;

  constructor(
    init: BaseRequestInputSnapshot & {
      allowTradingviewFallback?: boolean;
      exchange?: string;
      identifierResolutionMs?: number;
      symbol?: string;
      yahooSymbol?: string;
    },
  ) {
    super(init, init.identifierResolutionMs);
    this.allowTradingviewFallback = init.allowTradingviewFallback === true;
    this.exchange = init.exchange || "";
    this.symbol = init.symbol || "";
    this.yahooSymbol = init.yahooSymbol || "";
  }
}

export class FxRequest extends BaseRequest {
  readonly baseCurrency: string;
  readonly classification = "fx";
  readonly fxPair: FxPair;
  readonly quoteCurrency: string;
  readonly requestType = "fx";

  constructor(
    init: BaseRequestInputSnapshot & {
      fxPair: FxPair;
      identifierResolutionMs?: number;
    },
  ) {
    super(init, init.identifierResolutionMs);
    this.baseCurrency = init.fxPair.baseCanonicalCode;
    this.fxPair = init.fxPair;
    this.quoteCurrency = init.fxPair.quoteCanonicalCode;
  }
}

export type ResolvedRequest = EquityRequest | FxRequest;
