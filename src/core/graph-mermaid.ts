import type { Graph } from "./flow/graph";

function escapeMermaidLabel(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function formatGraphNodeLabel(
  node: { id: string; type?: string },
  options: { isSubgraphRoot?: boolean; isSubgraphTerminal?: boolean } = {},
): string {
  const parts: string[] = [];

  if (options.isSubgraphRoot) {
    parts.push("ROOT");
  }

  if (options.isSubgraphTerminal) {
    parts.push("TERMINAL");
  }

  parts.push(node.id);
  if (node.type) {
    parts.push(node.type);
  }

  return parts.map(escapeMermaidLabel).join("<br/>");
}

export function renderGraphAsMermaidFlowchart(
  graph: Graph.View,
  options: { direction?: "TD" | "LR" } = {},
): string {
  const direction = options.direction === "LR" ? "LR" : "TD";
  const orderedNodes = graph.getTopologicalOrder();
  const aliasByNodeId: Record<string, string> = Object.create(null);
  const lines = [`flowchart ${direction}`];
  const subgraphRootIds = new Set<string>();
  const subgraphTerminalIds = new Set<string>();

  for (const subgraphId of graph.getSubgraphIds()) {
    const subgraph = graph.getSubgraph(subgraphId);
    if (!subgraph) {
      continue;
    }

    subgraphRootIds.add(subgraph.rootNodeId);
    subgraphTerminalIds.add(subgraph.terminalNodeId);
  }

  orderedNodes.forEach((node, index) => {
    aliasByNodeId[node.id] = `N${index}`;
  });

  // Collect subgroups in topological order of their first member
  const subgraphNodeIds: Record<string, string[]> = Object.create(null);
  const subgraphOrder: string[] = [];

  for (const node of orderedNodes) {
    const group = node.group;
    if (!group) {
      continue;
    }

    if (!subgraphNodeIds[group]) {
      subgraphNodeIds[group] = [];
      subgraphOrder.push(group);
    }

    subgraphNodeIds[group].push(node.id);
  }

  const groupedNodeIds = new Set(Object.values(subgraphNodeIds).flat());

  // Emit ungrouped nodes first (topological order), then subgraph blocks
  for (const node of orderedNodes) {
    if (!groupedNodeIds.has(node.id)) {
      lines.push(
        `  ${aliasByNodeId[node.id]}["${formatGraphNodeLabel(node, {
          isSubgraphRoot: subgraphRootIds.has(node.id),
          isSubgraphTerminal: subgraphTerminalIds.has(node.id),
        })}"]`,
      );
    }
  }

  for (const group of subgraphOrder) {
    const escapedGroup = escapeMermaidLabel(group);
    lines.push(
      `  subgraph ${aliasByNodeId[subgraphNodeIds[group]![0]!] ?? group}SG["${escapedGroup}"]`,
    );
    // Declaring direction (even matching the parent) triggers ELK SEPARATE
    // hierarchy handling, which routes cross-subgraph edges around the box
    // rather than through it.
    lines.push(`    direction ${direction}`);
    for (const nodeId of subgraphNodeIds[group]!) {
      lines.push(
        `    ${aliasByNodeId[nodeId]}["${formatGraphNodeLabel(
          graph.getNode(nodeId)!,
          {
            isSubgraphRoot: subgraphRootIds.has(nodeId),
            isSubgraphTerminal: subgraphTerminalIds.has(nodeId),
          },
        )}"]`,
      );
    }
    lines.push(`  end`);
  }

  // Emit all edges
  for (const node of orderedNodes) {
    const fromAlias = aliasByNodeId[node.id];
    if (!fromAlias) {
      continue;
    }

    for (const childId of node.next || []) {
      const toAlias = aliasByNodeId[childId];
      if (!toAlias) {
        continue;
      }

      lines.push(`  ${fromAlias} --> ${toAlias}`);
    }

    for (const subgraphId of node.subgraphCalls || []) {
      const subgraph = graph.getSubgraph(subgraphId);
      const toAlias = subgraph ? aliasByNodeId[subgraph.rootNodeId] : "";

      if (!toAlias) {
        continue;
      }

      lines.push(
        `  ${fromAlias} -. "${escapeMermaidLabel(`call ${subgraphId}`)}" .-> ${toAlias}`,
      );
    }
  }

  return lines.join("\n");
}
