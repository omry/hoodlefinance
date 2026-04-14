export type AttributeType = "quote" | "isin";

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

interface RequestInputInit {
  attribute: string;
  attributeRequest: AttributeRequest;
  attributeType: AttributeType;
  classification: RequestClassification;
  fxPair: FxPair | null;
  identifier: string;
  infoMode: ParsedTickerRequest["infoMode"];
  ticker: string;
}

interface RequestInputRuntimeDependencies {
  looksLikeIsin(value: string): boolean;
  normalizeAttribute(attribute: unknown): string;
  parseAttributeRequest(attribute: string): AttributeRequest;
  parseFxTicker(ticker: string): FxPair | null;
  parseTickerRequest(ticker: string): ParsedTickerRequest;
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

function isRequestInputInit(value: unknown): value is RequestInputInit {
  return !!value && typeof value === "object" && "attributeRequest" in value;
}

function classifyRequestInputFromDerivedState(
  ticker: string,
  fxPair: FxPair | null,
  looksLikeIsin: (value: string) => boolean,
): RequestClassification {
  const upperTicker = String(ticker || "").trim().toUpperCase();

  if (looksLikeIsin(ticker)) {
    return "isin";
  }

  if (upperTicker.startsWith("ISIN:")) {
    return "isin";
  }

  if (fxPair) {
    return "fx";
  }

  return "equity";
}

export class RequestInput {
  private static runtimeDependencies: RequestInputRuntimeDependencies | null = null;

  readonly attribute: string;
  readonly attributeRequest: AttributeRequest;
  readonly attributeType: AttributeType;
  readonly classification: RequestClassification;
  readonly fxPair: FxPair | null;
  readonly identifier: string;
  readonly infoMode: ParsedTickerRequest["infoMode"];
  readonly ticker: string;

  constructor(init: RequestInputInit);
  constructor(identifier: unknown, attribute?: unknown);
  constructor(
    identifier: unknown,
    attribute: unknown,
    deps: RequestInputRuntimeDependencies,
  );
  constructor(
    initOrIdentifier: RequestInputInit | unknown,
    attribute?: unknown,
    deps?: RequestInputRuntimeDependencies,
  ) {
    if (isRequestInputInit(initOrIdentifier)) {
      const init = initOrIdentifier;

      this.attribute = init.attribute;
      this.attributeRequest = init.attributeRequest;
      this.attributeType = init.attributeType;
      this.classification = init.classification;
      this.fxPair = init.fxPair;
      this.identifier = init.identifier;
      this.infoMode = init.infoMode;
      this.ticker = init.ticker;
      return;
    }

    const runtimeDeps = deps || RequestInput.runtimeDependencies;
    if (!runtimeDeps) {
      throw new Error(
        "RequestInput runtime dependencies are not configured.",
      );
    }

    const rawIdentifier = String(
      initOrIdentifier == null ? "" : initOrIdentifier,
    ).trim();
    const normalizedAttribute = runtimeDeps.normalizeAttribute(attribute);
    const attributeRequest =
      runtimeDeps.parseAttributeRequest(normalizedAttribute);
    const parsedIdentifier = runtimeDeps.parseTickerRequest(rawIdentifier);
    const requestTicker = parsedIdentifier.ticker;
    const fxPair = runtimeDeps.parseFxTicker(requestTicker);

    this.attribute = normalizedAttribute;
    this.attributeRequest = attributeRequest;
    this.attributeType =
      attributeRequest.baseAttribute === "isin" ? "isin" : "quote";
    this.fxPair = fxPair;
    this.identifier = rawIdentifier;
    this.infoMode = parsedIdentifier.infoMode;
    this.ticker = requestTicker;
    this.classification = classifyRequestInputFromDerivedState(
      this.ticker,
      this.fxPair,
      runtimeDeps.looksLikeIsin,
    );
  }

  static configureRuntime(
    deps: RequestInputRuntimeDependencies | null,
  ): void {
    RequestInput.runtimeDependencies = deps;
  }

  static getRuntimeDependencies(): RequestInputRuntimeDependencies | null {
    return RequestInput.runtimeDependencies;
  }

  static _resetForTests(): void {
    RequestInput.runtimeDependencies = null;
  }
}

export function classifyRequestInput(
  input: Pick<RequestInput, "fxPair" | "ticker">,
  looksLikeIsin: (value: string) => boolean,
): RequestClassification {
  return classifyRequestInputFromDerivedState(
    String(input.ticker || "").trim(),
    input.fxPair,
    looksLikeIsin,
  );
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

interface EquityRequestInit extends BaseRequestInputSnapshot {
  allowTradingviewFallback?: boolean;
  exchange?: string;
  identifierResolutionMs?: number;
  symbol?: string;
  yahooSymbol?: string;
}

export class EquityRequest extends BaseRequest {
  readonly allowTradingviewFallback: boolean;
  readonly classification = "equity";
  readonly exchange: string;
  readonly requestType = "equity";
  readonly symbol: string;
  readonly yahooSymbol: string;

  constructor(init: EquityRequestInit) {
    super(init, init.identifierResolutionMs);
    this.allowTradingviewFallback = init.allowTradingviewFallback === true;
    this.exchange = init.exchange || "";
    this.symbol = init.symbol || "";
    this.yahooSymbol = init.yahooSymbol || "";
  }
}

interface FxRequestInit extends BaseRequestInputSnapshot {
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
    super(init, init.identifierResolutionMs);
    this.baseCurrency = init.fxPair.baseCanonicalCode;
    this.fxPair = init.fxPair;
    this.quoteCurrency = init.fxPair.quoteCanonicalCode;
  }
}

export type ResolvedRequest = EquityRequest | FxRequest;
