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
