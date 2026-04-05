import type { RoutingGraph, RoutingNode, NodeOutcome, NodeInput } from "./routing-graph";

export interface EngineResult {
  settled: Map<RoutingNode, NodeOutcome>;
}

export function executeGraph(graph: RoutingGraph): EngineResult {
  // Validate unique names
  const names = new Set<string>();
  for (const node of graph.nodes) {
    if (names.has(node.name)) throw new Error(`Duplicate node name: "${node.name}"`);
    names.add(node.name);
  }

  const settled = new Map<RoutingNode, NodeOutcome>();

  // Build parent count and input accumulators per node
  const parentCount = new Map<RoutingNode, number>();
  const accumulated = new Map<RoutingNode, Record<string, NodeInput>>();

  for (const node of graph.nodes) {
    if (!parentCount.has(node)) parentCount.set(node, 0);
    accumulated.set(node, {});
    for (const child of node.next) {
      parentCount.set(child, (parentCount.get(child) ?? 0) + 1);
    }
  }

  // Enqueue root nodes (no parents)
  const queue: RoutingNode[] = graph.nodes.filter(
    (n) => (parentCount.get(n) ?? 0) === 0,
  );

  while (queue.length > 0) {
    const node = queue.shift()!;
    const inputs = accumulated.get(node)!;

    // If any parent failed, propagate failure without calling execute
    const parentFailed = Object.values(inputs).some(
      (inp) => settled.get(inp.node)?.status === "failed",
    );

    let outcome: NodeOutcome;
    if (parentFailed) {
      outcome = { status: "failed", error: "dependency failed" };
    } else {
      try {
        const value = node.execute(inputs);
        outcome = { status: "settled", value };
      } catch (err) {
        outcome = {
          status: "failed",
          error: err instanceof Error ? err.message : String(err ?? ""),
        };
      }
    }

    settled.set(node, outcome);

    // Push to all downstream nodes (success or failure — child needs to know
    // all parents have reported before it can check and fire)
    for (const child of node.next) {
      const childInputs = accumulated.get(child)!;
      childInputs[node.name] = { node, value: outcome.value };
      if (Object.keys(childInputs).length === parentCount.get(child)) {
        queue.push(child);
      }
    }
  }

  return { settled };
}
