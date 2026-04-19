export type ResolutionResult<T> =
  | { elapsedMs: number; status: "success"; value: T }
  | { elapsedMs: number; error: string; status: "failure" };

function createResolutionResult<T extends Record<string, unknown>>(
  status: ResolutionResult<unknown>["status"],
  options: T,
): { status: ResolutionResult<unknown>["status"] } & T {
  return { status, ...options };
}

export function createResolutionSuccess<T>(
  value: T,
  elapsedMs: number,
): ResolutionResult<T> {
  return createResolutionResult("success", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    value,
  }) as ResolutionResult<T>;
}

export function createResolutionFailure(
  error: unknown,
  elapsedMs: number,
  errorMessage: (error: unknown) => string,
): ResolutionResult<never> {
  return createResolutionResult("failure", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    error: errorMessage(error),
  }) as ResolutionResult<never>;
}

export enum RoutingNodeKind {
  Leaf = "leaf",
  Switch = "switch",
  TryEach = "try each",
  Step = "step",
}

export interface LookupResult {
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}

export interface ExecutionContext {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}

export interface SelectNextContext {
  // Tracks child nodes already returned during the current routing-node traversal.
  selectedNodeCodes?: Set<string>;
}

export function describePlanSource(
  plan:
    | {
        routeClass?: unknown;
        routePath?: unknown;
      }
    | null
    | undefined,
): string {
  if (!plan) {
    return "";
  }

  const routeClass =
    plan.routeClass != null ? String(plan.routeClass).trim() : "";
  const routePath = plan.routePath != null ? String(plan.routePath).trim() : "";

  if (!routeClass) {
    return routePath;
  }

  if (!routePath || routeClass.startsWith("FORCED:")) {
    return routePath || routeClass;
  }

  return `${routeClass} -> ${routePath}`;
}
