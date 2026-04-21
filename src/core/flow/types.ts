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

// Flow node kinds:
// - Leaf: execute work and terminate without selecting or traversing children.
// - StepForward: execute work, then continue to exactly one child.
// - Switch: select exactly one child for the current request.
// - TryEach: try eligible children one at a time until one succeeds.
// - Step: fan out to all children in one step.
export enum NodeKind {
  Leaf = "leaf",
  StepForward = "step_forward",
  Switch = "switch",
  TryEach = "try_each",
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
