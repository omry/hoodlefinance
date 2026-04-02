export type AttributeType = "quote" | "isin";

export type RequestClassification = "equity" | "fx" | "isin";

export interface AttributeRequest {
  baseAttribute: string;
  outputCurrency: string;
}

export interface FxPair {
  baseCanonicalCode: string;
  quoteCanonicalCode: string;
  yahooChartSymbol: string;
}

export interface ParsedTickerRequest {
  infoMode: "" | "source-list" | "source-name";
  sourceOverride: string;
  ticker: string;
}

export interface RequestInputInit {
  attribute: string;
  attributeRequest: AttributeRequest;
  attributeType: AttributeType;
  classification: RequestClassification;
  fxPair: FxPair | null;
  identifier: string;
  infoMode: ParsedTickerRequest["infoMode"];
  sourceOverride: string;
  ticker: string;
  upperTicker: string;
}

export class RequestInput {
  readonly attribute: string;
  readonly attributeRequest: AttributeRequest;
  readonly attributeType: AttributeType;
  readonly classification: RequestClassification;
  readonly fxPair: FxPair | null;
  readonly identifier: string;
  readonly infoMode: ParsedTickerRequest["infoMode"];
  readonly sourceOverride: string;
  readonly ticker: string;
  readonly upperTicker: string;

  constructor(init: RequestInputInit) {
    this.attribute = init.attribute;
    this.attributeRequest = init.attributeRequest;
    this.attributeType = init.attributeType;
    this.classification = init.classification;
    this.fxPair = init.fxPair;
    this.identifier = init.identifier;
    this.infoMode = init.infoMode;
    this.sourceOverride = init.sourceOverride;
    this.ticker = init.ticker;
    this.upperTicker = init.upperTicker;
  }
}

export interface BaseRequestInputSnapshot {
  attribute: string;
  identifier: string;
}

export class BaseRequest {
  readonly identifierResolutionMs: number;
  readonly input: BaseRequestInputSnapshot;

  constructor(input: BaseRequestInputSnapshot, identifierResolutionMs = 0) {
    this.identifierResolutionMs = identifierResolutionMs;
    this.input = input;
  }
}

export interface EquityRequestInit extends BaseRequestInputSnapshot {
  allowTradingviewFallback: boolean;
  exchange: string;
  identifierResolutionMs?: number;
  symbol: string;
  yahooSymbol: string;
}

export class EquityRequest extends BaseRequest {
  readonly allowTradingviewFallback: boolean;
  readonly classification = "equity";
  readonly exchange: string;
  readonly requestType = "equity";
  readonly symbol: string;
  readonly yahooSymbol: string;

  constructor(init: EquityRequestInit) {
    super(init, init.identifierResolutionMs ?? 0);
    this.allowTradingviewFallback = init.allowTradingviewFallback;
    this.exchange = init.exchange;
    this.symbol = init.symbol;
    this.yahooSymbol = init.yahooSymbol;
  }
}

export interface FxRequestInit extends BaseRequestInputSnapshot {
  fxPair: FxPair;
  identifierResolutionMs?: number;
}

export class FxRequest extends BaseRequest {
  readonly baseCurrency: string;
  readonly classification = "fx";
  readonly fxPair: FxPair;
  readonly quoteCurrency: string;
  readonly requestType = "fx";

  constructor(init: FxRequestInit) {
    super(init, init.identifierResolutionMs ?? 0);
    this.baseCurrency = init.fxPair.baseCanonicalCode;
    this.fxPair = init.fxPair;
    this.quoteCurrency = init.fxPair.quoteCanonicalCode;
  }
}

export type ResolvedRequest = EquityRequest | FxRequest;
