import type { Resolver } from "./resolver-classes";

export type RouteKind = "attribute" | "identifier" | "quote";
export enum RoutingNodeKind {
  Leaf = "leaf",
  Switch = "switch",
  TryEach = "try each",
  Step = "step",
}

export type ResolutionResult<T> =
  | { elapsedMs: number; status: "success"; value: T }
  | { elapsedMs: number; error: string; status: "failure" };

export interface RuntimePlan<RouteState = Record<string, unknown>> {
  nodes: Resolver[];
  routeClass: string;
  routePath: string;
  routeState: RouteState;
}

export type RouteClassResolver = (request: unknown) => string;

export type RoutePathResolver = (request: unknown) => string;

export interface ResolverExecutionContext<
  RouteState = Record<string, unknown>,
> {
  attribute: string;
  routeKind: RouteKind;
  routeState: RouteState;
  tickerInput: string;
}


