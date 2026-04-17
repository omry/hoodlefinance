export namespace Graph {
  export interface Subgraph {
    rootNodeId: string;
    terminalNodeId: string;
  }

  export type SubgraphRegistry = Record<string, Subgraph>;

  export interface Node {
    id: string;
    type: string;
    next?: string[];
    group?: string;
    subgraphCalls?: string[];
  }

  // TODO: Before loading graph definitions from JSON files, add a dedicated
  // runtime parser/validator for raw input instead of trusting casts to this
  // internal normalized type.
  export interface Definition {
    [id: string]: Node | SubgraphRegistry | undefined;
    __subgraphs__?: SubgraphRegistry;
  }

  export interface View {
    definition: Definition;
    getNode(id: string): Node | null;
    getRoot(): Node | null;
    getTerminal(): Node | null;
    getChildren(id: string): Node[];
    getParents(id: string): Node[];
    getTopologicalOrder(): Node[];
    getSubgraph(id: string): Subgraph | null;
    getSubgraphIds(): string[];
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

export function getGraphNodeSubgraphCallIds(node: Graph.Node): string[] {
  const result: string[] = [];

  for (const id of node.subgraphCalls || []) {
    addNormalizedNodeId(result, id);
  }

  return result;
}
