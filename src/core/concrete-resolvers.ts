import type { ResolverSpec, ResolverSpecOptions } from "./plan-specs";
import { FxRequest, RequestInput, type ResolvedRequest } from "./request";
import { buildIsinIdentifierRouteState } from "./route-state";
import {
  AttributeResolver,
  IdentifierResolver,
  RouteExecutionResolver,
} from "./resolver-classes";
import {
  buildTypedRequestFromParsedInput,
  buildTypedRequestFromResolvedTicker,
  extractIsinFromRequestInput,
} from "./request-building";
import { buildSameCurrencyQuote, decorateFxQuote, isSameCurrencyFxPair } from "./fx-quotes";
import {
  buildGoogleFinanceQuoteUrl,
  extractGoogleFinanceFxPairQuote,
} from "./google-fx";
import {
  buildYahooIsinSearchUrl,
  extractYahooSymbolFromSearchResponse,
  type YahooSearchResponseLike,
} from "./yahoo-isin-search";
import {
  createResolutionFailure,
  createResolutionSuccess,
  createRouteResult,
  type RouteResult,
} from "./route-results";
import type { RouteJob, RuntimePlan } from "./planner";
import type { ResolverClassLike } from "./resolver-materialization";
import { buildFxQuoteRouteState } from "./route-state";

export class DirectIdentifierResolver extends IdentifierResolver {
  constructor() {
    super("DIRECT-IDENTIFIER");
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return input instanceof RequestInput && !extractIsinFromRequestInput(input);
  }

  resolve(input: RequestInput | ResolvedRequest) {
    const startedAtMs = Date.now();

    try {
      if (!this.canHandle(input)) {
        return createResolutionFailure(
          "Identifier resolution requires a discovery resolver.",
          Date.now() - startedAtMs,
          (error) => String(error instanceof Error ? error.message : error ?? ""),
        );
      }

      const requestInput = input as RequestInput;
      const resolvedRequest = buildTypedRequestFromParsedInput(
        requestInput,
        requestInput,
        0,
      );
      resolvedRequest.identifierResolutionMs = Math.max(
        0,
        Date.now() - startedAtMs,
      );

      return createResolutionSuccess(
        resolvedRequest,
        resolvedRequest.identifierResolutionMs,
      );
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        (caughtError) =>
          String(caughtError instanceof Error ? caughtError.message : caughtError ?? ""),
      );
    }
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
  ): DirectIdentifierResolver {
    return new this();
  }
}

export type ResolveValueFunction = (
  job: RouteJob<Record<string, unknown>>,
) => unknown;

export interface FunctionValueResolverDependencies {
  resolveFunctionsByRef: Record<string, ResolveValueFunction | undefined>;
}

export type ResolvePseTickerFromIsinMap = (isin: string) => string;
export interface YahooIsinSearchRequest {
  cacheKey: string;
  index: number;
  isin: string;
  url: string;
}

export interface YahooIsinSearchBatchResponse {
  error?: unknown;
  request: YahooIsinSearchRequest;
  response?: YahooSearchResponseLike;
}

export interface YahooIsinSearchResolverDependencies {
  fetchAllInChunks(
    source: string,
    requests: YahooIsinSearchRequest[],
  ): YahooIsinSearchBatchResponse[];
  getCachedString(cacheKey: string): string;
  putCachedString(cacheKey: string, value: string, ttlSeconds: number): string;
}

export interface GoogleFxResolverDependencies {
  fetchText(url: string): string;
  getCachedJson(cacheKey: string): unknown;
  putCachedJson(cacheKey: string, value: unknown, ttlSeconds: number): unknown;
}

export class PseIsinMapResolver extends IdentifierResolver {
  readonly traceLabel: string;
  readonly resolvePseTickerFromIsinMap: ResolvePseTickerFromIsinMap;

  constructor(resolvePseTickerFromIsinMap: ResolvePseTickerFromIsinMap) {
    super("PSE-MAP", "PSE", {
      routingDescription: "PSE ISIN map lookup",
    });
    this.traceLabel = "pse-isin-map";
    this.resolvePseTickerFromIsinMap = resolvePseTickerFromIsinMap;
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    const isin = extractIsinFromRequestInput(
      input as Pick<RequestInput, "ticker">,
    );

    return input instanceof RequestInput && isin.startsWith("PH");
  }

  getAttributeOverrideSources(input: RequestInput | ResolvedRequest): string[] {
    return input instanceof RequestInput &&
      this.canHandle(input) &&
      input.attributeType === "quote"
      ? ["PSE"]
      : [];
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof RequestInput)) {
      return {};
    }

    return buildIsinIdentifierRouteState(request, extractIsinFromRequestInput);
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.traceLabel,
      routeState: this.buildRouteState(request),
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results = [];

    for (const job of jobs) {
      try {
        const isin = String(job.routeState.isin || "").trim();
        const pseTicker = this.resolvePseTickerFromIsinMap(isin);

        if (!pseTicker) {
          results.push(createRouteResult("lookup_failure"));
          continue;
        }

        results.push(
          createRouteResult("success", {
            value: buildTypedRequestFromResolvedTicker(
              job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
              pseTicker,
              0,
            ),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    resolvePseTickerFromIsinMap?: ResolvePseTickerFromIsinMap,
  ): PseIsinMapResolver {
    if (typeof resolvePseTickerFromIsinMap !== "function") {
      throw new Error(
        "PseIsinMapResolver requires resolvePseTickerFromIsinMap.",
      );
    }

    return new this(resolvePseTickerFromIsinMap);
  }
}

export class YahooIsinSearchResolver extends IdentifierResolver {
  readonly traceLabel: string;
  readonly fetchAllInChunks: YahooIsinSearchResolverDependencies["fetchAllInChunks"];
  readonly getCachedString: YahooIsinSearchResolverDependencies["getCachedString"];
  readonly putCachedString: YahooIsinSearchResolverDependencies["putCachedString"];

  constructor(deps: YahooIsinSearchResolverDependencies) {
    super("YAHOO-ISIN", "YAHOO", {
      routingDescription: "Yahoo search by ISIN",
    });
    this.traceLabel = "YAHOO-ISIN";
    this.fetchAllInChunks = deps.fetchAllInChunks;
    this.getCachedString = deps.getCachedString;
    this.putCachedString = deps.putCachedString;
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return (
      input instanceof RequestInput &&
      !!extractIsinFromRequestInput(input)
    );
  }

  getAttributeOverrideSources(input: RequestInput | ResolvedRequest): string[] {
    return input instanceof RequestInput &&
      this.canHandle(input) &&
      input.attributeType === "quote"
      ? ["YAHOO"]
      : [];
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof RequestInput)) {
      return {};
    }

    return buildIsinIdentifierRouteState(request, extractIsinFromRequestInput);
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.traceLabel,
      routeState: this.buildRouteState(request),
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);
    const requests: YahooIsinSearchRequest[] = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      const cacheKey = `hoodlefinance:isin:${job.routeState.isin}`;
      const cached = this.getCachedString(cacheKey);

      if (cached) {
        results[i] = createRouteResult("success", {
          value: buildTypedRequestFromResolvedTicker(
            job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
            cached,
            0,
          ),
        });
        continue;
      }

      requests.push({
        cacheKey,
        index: i,
        isin: String(job.routeState.isin || "").trim(),
        url: buildYahooIsinSearchUrl(String(job.routeState.isin || "").trim()),
      });
    }

    const responses = this.fetchAllInChunks("yahoo-isin-search", requests);

    for (const responseItem of responses) {
      if (responseItem.error) {
        results[responseItem.request.index] = createRouteResult("lookup_failure", {
          error: responseItem.error,
        });
        continue;
      }

      try {
        const job = jobs[responseItem.request.index];
        if (!job) {
          results[responseItem.request.index] = createRouteResult(
            "terminal_error",
            {
              error: "Route job is missing for Yahoo ISIN search response.",
            },
          );
          continue;
        }

        const resolvedTicker = extractYahooSymbolFromSearchResponse(
          responseItem.response as YahooSearchResponseLike,
          responseItem.request.isin,
        );
        this.putCachedString(responseItem.request.cacheKey, resolvedTicker, 21600);
        results[responseItem.request.index] = createRouteResult("success", {
          value: buildTypedRequestFromResolvedTicker(
            job.routeState.input as Pick<RequestInput, "attribute" | "identifier">,
            resolvedTicker,
            0,
          ),
        });
      } catch (error) {
        results[responseItem.request.index] = createRouteResult("lookup_failure", {
          error,
        });
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: YahooIsinSearchResolverDependencies,
  ): YahooIsinSearchResolver {
    if (
      !deps ||
      typeof deps.fetchAllInChunks !== "function" ||
      typeof deps.getCachedString !== "function" ||
      typeof deps.putCachedString !== "function"
    ) {
      throw new Error(
        "YahooIsinSearchResolver requires fetchAllInChunks, getCachedString, and putCachedString.",
      );
    }

    return new this(deps);
  }
}

export class FunctionValueResolver extends AttributeResolver {
  readonly resolveValue: ResolveValueFunction;
  readonly traceLabel: string;

  constructor(
    code: string,
    traceLabel:
      | string
      | ResolveValueFunction
      | (ResolverSpecOptions & { sourceName?: string }),
    sourceName?:
      | string
      | ResolveValueFunction
      | (ResolverSpecOptions & { sourceName?: string }),
    resolveValue?: ResolveValueFunction | ResolverSpecOptions,
    options?: ResolverSpecOptions,
  ) {
    let resolvedTraceLabel = traceLabel;
    let resolvedSourceName = sourceName;
    let resolvedResolveValue = resolveValue;
    let config = options;

    if (typeof traceLabel === "function") {
      resolvedResolveValue = traceLabel;
      config = (sourceName || {}) as ResolverSpecOptions;
      resolvedTraceLabel = code;
      resolvedSourceName = code;
    }

    const normalizedTraceLabel = resolvedTraceLabel as string;
    const normalizedSourceName = resolvedSourceName as string;

    super(code, normalizedSourceName, config);
    this.traceLabel = normalizedTraceLabel;
    this.resolveValue = resolvedResolveValue as ResolveValueFunction;
  }

  buildRouteState(_request: RequestInput | ResolvedRequest): Record<string, unknown> {
    return {};
  }

  batchKey(_job: RouteJob, _attempt: unknown): string {
    return "";
  }

  getRouteClass(_request: RequestInput | ResolvedRequest): string {
    return this.name;
  }

  getRoutePath(_request: RequestInput | ResolvedRequest): string {
    return this.traceLabel;
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest) {
    return {
      nodes: [this],
      routeClass: this.getRouteClass(request),
      routePath: this.getRoutePath(request),
      routeState: this.buildRouteState(request),
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results = [];

    for (const job of jobs) {
      try {
        results.push(
          createRouteResult("success", {
            value: this.resolveValue(job),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    code: string,
    spec: ResolverSpec,
    deps: FunctionValueResolverDependencies,
  ): FunctionValueResolver {
    const resolveValue =
      deps.resolveFunctionsByRef[
        String(spec.resolveFunctionRef || "")
          .trim()
          .toUpperCase()
      ] || null;
    const traceLabel = (spec as ResolverSpec & { traceLabel?: string }).traceLabel;
    const sourceName = (spec as ResolverSpec & { sourceName?: string }).sourceName;
    const options = spec.options || {};

    if (!resolveValue) {
      throw new Error(
        `Unknown resolver function ref "${String(spec.resolveFunctionRef || "")}" for "${code}".`,
      );
    }

    return traceLabel || sourceName
      ? new this(
          code,
          traceLabel || code,
          sourceName || traceLabel || code,
          resolveValue,
          options,
        )
      : new this(code, resolveValue, options);
  }
}

export class LocalFxResolver extends RouteExecutionResolver {
  constructor() {
    super("LOCAL", "LOCAL", {
      routingDescription: "Same-currency FX identity rate",
    });
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      !!request &&
      "requestType" in request &&
      request.requestType === "fx" &&
      !!request.fxPair &&
      isSameCurrencyFxPair(request.fxPair)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!this.canHandle(request)) {
      return {};
    }

    const fxRequest = request as Extract<ResolvedRequest, { requestType: "fx" }>;

    return {
      fxPair: fxRequest.fxPair,
    };
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results = [];

    for (const job of jobs) {
      try {
        results.push(
          createRouteResult("success", {
            quote: buildSameCurrencyQuote(job.routeState.fxPair as import("./request").FxPair),
          }),
        );
      } catch (error) {
        results.push(createRouteResult("terminal_error", { error }));
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
  ): LocalFxResolver {
    return new this();
  }
}

export class GoogleFxResolver extends RouteExecutionResolver {
  readonly fetchText: GoogleFxResolverDependencies["fetchText"];
  readonly getCachedJson: GoogleFxResolverDependencies["getCachedJson"];
  readonly putCachedJson: GoogleFxResolverDependencies["putCachedJson"];

  constructor(deps: GoogleFxResolverDependencies) {
    super("GOOGLE", "GOOGLE", {
      isSourceOverrideable: true,
      representativeTicker: "EURUSD",
      routingDescription: "Google Finance FX quote lookup",
    });
    this.fetchText = deps.fetchText;
    this.getCachedJson = deps.getCachedJson;
    this.putCachedJson = deps.putCachedJson;
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    return (
      request instanceof FxRequest &&
      !!request.fxPair &&
      !isSameCurrencyFxPair(request.fxPair)
    );
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof FxRequest)) {
      return {};
    }

    return buildFxQuoteRouteState(request);
  }

  executeBatch(jobs: RouteJob<Record<string, unknown>>[]) {
    const results: Array<RouteResult | null> = jobs.map(() => null);

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      if (!job) {
        continue;
      }

      try {
        const fxPair = job.routeState.fxPair as FxRequest["fxPair"];
        const pairSlug = String(fxPair.googlePairSlug || "").trim();
        const cacheKey = `hoodlefinance:google-finance:${pairSlug}`;
        const cached = this.getCachedJson(cacheKey);

        if (cached) {
          results[i] = createRouteResult("success", {
            quote: decorateFxQuote(
              cached as Record<string, unknown>,
              fxPair,
            ),
          });
          continue;
        }

        const quote = extractGoogleFinanceFxPairQuote(
          this.fetchText(buildGoogleFinanceQuoteUrl(pairSlug)),
          fxPair,
        );
        this.putCachedJson(cacheKey, quote, 60);
        results[i] = createRouteResult("success", {
          quote: decorateFxQuote(quote, fxPair),
        });
      } catch (error) {
        results[i] = createRouteResult("terminal_error", { error });
      }
    }

    return results as unknown as Array<Record<string, unknown> | null>;
  }

  static fromSpec(
    _code: string,
    _spec: ResolverSpec,
    deps?: GoogleFxResolverDependencies,
  ): GoogleFxResolver {
    if (
      !deps ||
      typeof deps.fetchText !== "function" ||
      typeof deps.getCachedJson !== "function" ||
      typeof deps.putCachedJson !== "function"
    ) {
      throw new Error(
        "GoogleFxResolver requires fetchText, getCachedJson, and putCachedJson.",
      );
    }

    return new this(deps);
  }
}

export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  DirectIdentifierResolver,
  FunctionValueResolver,
  LocalFxResolver,
  GoogleFxResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
} as const;

export interface ConcreteResolverMaterializationDependencies
  extends FunctionValueResolverDependencies {
  googleFx?: GoogleFxResolverDependencies;
  resolvePseTickerFromIsinMap?: ResolvePseTickerFromIsinMap;
  yahooIsinSearch?: YahooIsinSearchResolverDependencies;
}

export function createConcreteResolverMaterializationDependencies(
  deps: ConcreteResolverMaterializationDependencies,
): {
  resolverClassDependenciesByName: Record<string, unknown>;
  resolverClassesByName: Record<string, ResolverClassLike>;
} {
  return {
    resolverClassDependenciesByName: {
      FunctionValueResolver: {
        resolveFunctionsByRef: deps.resolveFunctionsByRef,
      },
      GoogleFxResolver: deps.googleFx,
      PseIsinMapResolver: deps.resolvePseTickerFromIsinMap,
      YahooIsinSearchResolver: deps.yahooIsinSearch,
    },
    resolverClassesByName: {
      ...CONCRETE_RESOLVER_CLASSES_BY_NAME,
    },
  };
}
