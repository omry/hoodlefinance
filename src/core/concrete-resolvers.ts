import type { ResolverSpec, ResolverSpecOptions } from "./plan-specs";
import { RequestInput, type ResolvedRequest } from "./request";
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
import { buildSameCurrencyQuote, isSameCurrencyFxPair } from "./fx-quotes";
import { createResolutionFailure, createResolutionSuccess, createRouteResult } from "./route-results";
import type { RouteJob, RuntimePlan } from "./planner";
import type { ResolverClassLike } from "./resolver-materialization";

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

export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  DirectIdentifierResolver,
  FunctionValueResolver,
  LocalFxResolver,
  PseIsinMapResolver,
} as const;

export interface ConcreteResolverMaterializationDependencies
  extends FunctionValueResolverDependencies {
  resolvePseTickerFromIsinMap?: ResolvePseTickerFromIsinMap;
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
      PseIsinMapResolver: deps.resolvePseTickerFromIsinMap,
    },
    resolverClassesByName: {
      ...CONCRETE_RESOLVER_CLASSES_BY_NAME,
    },
  };
}
