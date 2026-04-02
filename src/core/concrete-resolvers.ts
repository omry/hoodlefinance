import type { ResolverSpec, ResolverSpecOptions } from "./plan-specs";
import { RequestInput, type ResolvedRequest } from "./request";
import { AttemptResolver, Resolver } from "./resolver-classes";
import { createResolutionFailure, createResolutionSuccess, createRouteResult } from "./route-results";
import type { RouteJob } from "./planner";

export interface DirectIdentifierResolverDependencies {
  buildTypedRequestFromParsedInput(
    originalInput: RequestInput,
    parsedInput: RequestInput,
    identifierResolutionMs: number,
  ): ResolvedRequest;
  extractIsinFromRequestInput(input: RequestInput): string;
}

export class DirectIdentifierResolver extends Resolver {
  readonly deps: DirectIdentifierResolverDependencies;

  constructor(deps: DirectIdentifierResolverDependencies) {
    super("DIRECT-IDENTIFIER");
    this.deps = deps;
  }

  canHandle(input: RequestInput | ResolvedRequest): boolean {
    return (
      input instanceof RequestInput && !this.deps.extractIsinFromRequestInput(input)
    );
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
      const resolvedRequest = this.deps.buildTypedRequestFromParsedInput(
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
}

export type ResolveValueFunction = (
  job: RouteJob<Record<string, unknown>>,
) => unknown;

export interface FunctionValueResolverDependencies {
  resolveFunctionsByRef: Record<string, ResolveValueFunction | undefined>;
}

export class FunctionValueResolver extends AttemptResolver {
  readonly resolveValue: ResolveValueFunction;

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

    super(
      code,
      resolvedTraceLabel as string,
      resolvedSourceName as string,
      config,
    );
    this.resolveValue = resolvedResolveValue as ResolveValueFunction;
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
