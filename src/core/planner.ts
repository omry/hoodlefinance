import type { Resolver } from "./resolver-classes";
import type { ResolverServices } from "./resolver-services";

export type RouteKind = "attribute" | "identifier" | "quote";
export type RoutingNodeKind =
  | "leaf"
  | "switch"
  | "try each"
  | "step";

export type ResolutionStatus = "success" | "failure";

export interface ResolutionSuccess<T> {
  elapsedMs: number;
  status: "success";
  value: T;
}

export interface ResolutionFailure {
  elapsedMs: number;
  error: string;
  status: "failure";
}

export type ResolutionResult<T> = ResolutionSuccess<T> | ResolutionFailure;

export interface RuntimePlan<RouteState = Record<string, unknown>> {
  nodes: Resolver[];
  routeClass: string;
  routePath: string;
  routeState: RouteState;
}

export type RouteClassResolver = (request: unknown) => string;

export type RoutePathResolver = (request: unknown) => string;

export interface RouteContext {
  outputCurrencyCache?: {
    conversionRateByPair: Record<string, number>;
    unitByCode: Record<string, string>;
  };
  plan?: RuntimePlan;
  tickerInput?: string;
}

export interface RouteJob<RouteState = Record<string, unknown>> {
  attribute: string;
  error: string | null;
  key: string;
  plan: RuntimePlan<RouteState> | null;
  quote: unknown;
  routeContext: RouteContext | null;
  routeKind: RouteKind;
  routeLastLookupFailure: string;
  routeNodes: Resolver[];
  routePreferredLookupFailure: string;
  routeRuntimeTrace: RouteTraceEntry[];
  routeState: RouteState;
  sourceQuote: unknown;
  tickerInput: string;
  value: unknown;
  valueResolved: boolean;
}

export interface RouteTraceEntry {
  elapsedMs: number | null;
  label: string;
  status: string;
}

