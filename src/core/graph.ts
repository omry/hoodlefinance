export namespace Graph {
  export interface Node {
    id: string;
    type: string;
    next?: string[];
    group?: string;
  }

  export type Definition = Record<string, Node>;

  export interface View {
    definition: Definition;
    getNode(id: string): Node | null;
    getRoot(): Node | null;
    getTerminal(): Node | null;
    getChildren(id: string): Node[];
    getParents(id: string): Node[];
    getTopologicalOrder(): Node[];
  }
}

export function normalizeGraphNodeId(id: string): string {
  return String(id || "")
    .trim()
    .toUpperCase();
}

function addNormalizedNodeId(result: string[], id: string): void {
  const normalizedId = normalizeGraphNodeId(id);
  if (normalizedId && !result.includes(normalizedId)) {
    result.push(normalizedId);
  }
}

export function getGraphNodeNextIds(node: Graph.Node): string[] {
  const result: string[] = [];

  for (const id of node.next || []) {
    addNormalizedNodeId(result, id);
  }

  return result;
}
