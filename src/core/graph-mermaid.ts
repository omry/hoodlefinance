import type { Graph } from "./graph";

interface MermaidFlowchartRenderOptions {
  direction?: "TD" | "LR";
}

function escapeMermaidLabel(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function formatNodeLabel(node: { id: string; type?: string }): string {
  const parts = [node.id];

  if (node.type) {
    parts.push(node.type);
  }

  return parts.map(escapeMermaidLabel).join("<br/>");
}

export function renderGraphAsMermaidFlowchart(
  graph: Graph.View,
  options: MermaidFlowchartRenderOptions = {},
): string {
  const direction = options.direction === "LR" ? "LR" : "TD";
  const orderedNodes = graph.getTopologicalOrder();
  const aliasByNodeId: Record<string, string> = Object.create(null);
  const lines = [`flowchart ${direction}`];

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

  const groupedNodeIds = new Set(
    Object.values(subgraphNodeIds).flat(),
  );

  // Emit ungrouped nodes first (topological order), then subgraph blocks
  for (const node of orderedNodes) {
    if (!groupedNodeIds.has(node.id)) {
      lines.push(`  ${aliasByNodeId[node.id]}["${formatNodeLabel(node)}"]`);
    }
  }

  for (const group of subgraphOrder) {
    const escapedGroup = escapeMermaidLabel(group);
    lines.push(`  subgraph ${aliasByNodeId[subgraphNodeIds[group]![0]!] ?? group}SG["${escapedGroup}"]`);
    // Declaring direction (even matching the parent) triggers ELK SEPARATE
    // hierarchy handling, which routes cross-subgraph edges around the box
    // rather than through it.
    lines.push(`    direction ${direction}`);
    for (const nodeId of subgraphNodeIds[group]!) {
      lines.push(`    ${aliasByNodeId[nodeId]}["${formatNodeLabel(graph.getNode(nodeId)!)}"]`);
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
  }

  return lines.join("\n");
}
