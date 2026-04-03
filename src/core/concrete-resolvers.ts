import type { ResolverSpec, ResolverSpecOptions } from "./plan-specs";
import { RequestInput, type ResolvedRequest } from "./request";
import {
  AttributeResolver,
  IdentifierResolver,
} from "./resolver-classes";
import {
  buildTypedRequestFromParsedInput,
  extractIsinFromRequestInput,
} from "./request-building";
import { createResolutionFailure, createResolutionSuccess, createRouteResult } from "./route-results";
import type { RouteJob } from "./planner";
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

export const CONCRETE_RESOLVER_CLASSES_BY_NAME = {
  DirectIdentifierResolver,
  FunctionValueResolver,
} as const;

export interface ConcreteResolverMaterializationDependencies
  extends FunctionValueResolverDependencies {}

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
    },
    resolverClassesByName: {
      ...CONCRETE_RESOLVER_CLASSES_BY_NAME,
    },
  };
}
