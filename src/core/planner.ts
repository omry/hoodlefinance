export enum RoutingNodeKind {
  Leaf = "leaf",
  Switch = "switch",
  TryEach = "try each",
  Step = "step",
}

export type ResolutionResult<T> =
  | { elapsedMs: number; status: "success"; value: T }
  | { elapsedMs: number; error: string; status: "failure" };


