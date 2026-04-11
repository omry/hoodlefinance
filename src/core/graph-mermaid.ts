import type { Graph } from "./graph";

export interface MermaidFlowchartRenderOptions {
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
    const alias = `N${index}`;
    aliasByNodeId[node.id] = alias;
    lines.push(`  ${alias}["${formatNodeLabel(node)}"]`);
  });

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
