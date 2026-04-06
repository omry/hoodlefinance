export interface NodeOutcome<T = unknown> {
  status: "settled" | "failed";
  value?: T;          // present when status === "settled"
  error?: string;     // present when status === "failed"
}

/**
 * Passed to execute(): carries both the parent node (for type inspection)
 * and the value it produced.
 */
export interface NodeInput {
  node: RoutingNode;
  value: unknown;
}

export interface RoutingNode<TOutput = unknown> {
  /**
   * Unique, stable name within the graph.
   * Used as the key in the inputs map passed to execute().
   * Must not change between calls — node classes should derive it
   * deterministically from constructor args.
   */
  name: string;
  /** Downstream nodes this node feeds into. Wired by the builder. */
  next: RoutingNode[];
  /**
   * Execute this node. Receives named outputs from all parent nodes.
   * Throw to signal failure. Return value becomes the settled output.
   */
  execute(inputs: Record<string, NodeInput>): TOutput;
  /**
   * Optional: group key for batch dispatch. Nodes with the same executorId
   * are collected and dispatched together by the engine. Defaults to `name`.
   */
  executorId?: string;
}

export interface RoutingGraph {
  /** All nodes in the graph, in any order. */
  nodes: RoutingNode[];
  /**
   * One output node per identifier. The engine result is read from these.
   * Parallel to `input.identifiers`.
   */
  outputs: RoutingNode[];
}

/**
 * Retrieve the settled output of a specific parent node from the inputs map.
 * Throws if the parent is missing — indicates a graph wiring bug.
 * Return type is inferred from the parent node's TOutput.
 */
export function getInput<T>(inputs: Record<string, NodeInput>, node: RoutingNode<T>): T {
  const input = inputs[node.name];
  if (!input) throw new Error(`Missing input from node: ${node.name}`);
  return input.value as T;
}

/**
 * Retrieve settled outputs from a list of parent nodes of uniform type.
 * Useful for nodes with a variable number of homogeneous parents (e.g. FxRateBatchNode).
 */
export function getInputs<T>(inputs: Record<string, NodeInput>, nodes: RoutingNode<T>[]): T[] {
  return nodes.map((n) => getInput(inputs, n));
}
