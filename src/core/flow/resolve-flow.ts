import {
  type Graph,
  getGraphNodeNextIds,
  getGraphNodeSubgraphCallIds,
  normalizeGraphNodeId,
} from "./graph";
import type { Resolver } from "../resolver-classes";
import { type LookupResult } from "./resolver";
import {
  buildPlanNodeFromSpec,
  PLAN_RESOLVER_CLASSES_BY_NAME,
} from "../resolver-classes";
import { FlowEngine, EnvelopeStatus, type ExecutionTrace } from "./engine";

function isPlanResolverClass(nodeType: string): boolean {
  return !!(PLAN_RESOLVER_CLASSES_BY_NAME as Record<string, unknown>)[
    String(nodeType || "")
  ];
}

function normalizeCode(code: string): string {
  return normalizeGraphNodeId(code);
}

function formatCodeList(codes: string[]): string {
  return codes.join(", ");
}

interface GraphTopologyNode {
  node: Graph.Node;
  parentIds: string[];
}

function isGraphNodeEntry(
  value: Graph.Definition[string],
): value is Graph.Node {
  return (
    !!value && typeof value === "object" && "id" in value && "type" in value
  );
}

function normalizeDefinitionEntries(
  definition: Graph.Definition,
): Array<[string, Graph.Node]> {
  const normalizedEntries: Array<[string, Graph.Node]> = [];
  const originalKeyByNormalizedKey: Record<string, string> =
    Object.create(null);

  for (const [key, rawNode] of Object.entries(definition || {})) {
    if (key === "__subgraphs__") {
      continue;
    }

    if (!isGraphNodeEntry(rawNode)) {
      throw new Error(
        `Graph definition entry "${String(key || "")}" must be a node definition.`,
      );
    }

    const normalizedKey = normalizeCode(key);

    if (!normalizedKey) {
      throw new Error(
        `Graph definition contains an empty node id from key ${JSON.stringify(key)}.`,
      );
    }

    const existingKey = originalKeyByNormalizedKey[normalizedKey];
    if (existingKey) {
      throw new Error(
        `Graph definition contains duplicate normalized code "${normalizedKey}" from keys ${JSON.stringify(existingKey)} and ${JSON.stringify(key)}.`,
      );
    }

    const normalizedId = normalizeCode(rawNode?.id || "");
    if (!normalizedId) {
      throw new Error(
        `Graph definition node "${normalizedKey}" must declare a non-empty id.`,
      );
    }

    if (normalizedId !== normalizedKey) {
      throw new Error(
        `Graph definition key "${normalizedKey}" must match node.id "${normalizedId}".`,
      );
    }

    const normalizedType = String(rawNode?.type || "").trim();
    if (!normalizedType) {
      throw new Error(
        `Graph definition node "${normalizedKey}" must declare a non-empty type.`,
      );
    }

    const normalizedNode: Graph.Node = {
      id: normalizedId,
      type: normalizedType,
    };
    const nextIds = getGraphNodeNextIds(rawNode);

    if (nextIds.length > 0) {
      normalizedNode.next = nextIds;
    }

    const group = String(rawNode.group || "").trim();
    if (group) {
      normalizedNode.group = group;
    }

    const subgraphCalls = getGraphNodeSubgraphCallIds(rawNode);
    if (subgraphCalls.length > 0) {
      normalizedNode.subgraphCalls = subgraphCalls;
    }

    originalKeyByNormalizedKey[normalizedKey] = key;
    normalizedEntries.push([normalizedKey, normalizedNode]);
  }

  if (normalizedEntries.length === 0) {
    throw new Error("Graph definition must contain at least one node.");
  }

  return normalizedEntries;
}

function buildTopologicalOrder(
  nodes: Graph.Node[],
  nodesById: Record<string, GraphTopologyNode>,
): Graph.Node[] {
  const topologicalOrder: Graph.Node[] = [];
  const queue = nodes.filter((node) => {
    const entry = nodesById[node.id];

    return !!entry && entry.parentIds.length === 0;
  });
  const remainingParentCount: Record<string, number> = Object.create(null);

  for (const node of nodes) {
    remainingParentCount[node.id] = nodesById[node.id]?.parentIds.length || 0;
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }

    topologicalOrder.push(node);
    for (const childId of node.next || []) {
      const childEntry = nodesById[childId];
      if (!childEntry) {
        continue;
      }
      const nextParentCount = (remainingParentCount[childId] || 0) - 1;
      remainingParentCount[childId] = nextParentCount;
      if (nextParentCount === 0) {
        queue.push(childEntry.node);
      }
    }
  }

  if (topologicalOrder.length !== nodes.length) {
    const orderedIds = new Set(topologicalOrder.map((node) => node.id));
    const cycleIds = nodes
      .map((node) => node.id)
      .filter((id) => !orderedIds.has(id));
    throw new Error(
      `Graph definition contains a cycle involving: ${formatCodeList(cycleIds)}.`,
    );
  }

  return topologicalOrder;
}

function requireSingleBoundaryNode(
  kind: "root" | "terminal",
  nodes: Graph.Node[],
): Graph.Node {
  if (nodes.length !== 1) {
    const description =
      nodes.length > 0
        ? `: ${formatCodeList(nodes.map((node) => node.id))}`
        : "";
    throw new Error(
      `Graph definition must have exactly one ${kind}; found ${nodes.length}${description}.`,
    );
  }

  const firstNode = nodes[0] as Graph.Node;
  const requiredId = kind === "root" ? "ROOT" : "TERMINAL";

  if (firstNode.id !== requiredId) {
    throw new Error(
      `Graph ${kind} node must have id "${requiredId}"; found "${firstNode.id}".`,
    );
  }

  return firstNode;
}

function collectReachableIds(
  startId: string,
  nodesById: Record<string, GraphTopologyNode>,
  relation: "next" | "parentIds",
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) {
      continue;
    }

    visited.add(id);
    const entry = nodesById[id];
    if (!entry) {
      continue;
    }

    const relatedIds =
      relation === "next" ? entry.node.next || [] : entry.parentIds;
    for (const relatedId of relatedIds) {
      if (!visited.has(relatedId)) {
        queue.push(relatedId);
      }
    }
  }

  return visited;
}

function collectBoundedReachableIds(
  startId: string,
  terminalId: string,
  nodesById: Record<string, GraphTopologyNode>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) {
      continue;
    }

    visited.add(id);
    if (id === terminalId) {
      continue;
    }

    const entry = nodesById[id];
    if (!entry) {
      continue;
    }

    for (const nextId of entry.node.next || []) {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  return visited;
}

function normalizeSubgraphRegistry(
  definition: Graph.Definition,
): Graph.SubgraphRegistry {
  const normalizedRegistry: Graph.SubgraphRegistry = Object.create(null);
  const rawRegistry = definition.__subgraphs__;

  if (rawRegistry == null) {
    return normalizedRegistry;
  }

  if (typeof rawRegistry !== "object" || Array.isArray(rawRegistry)) {
    throw new Error("Graph definition __subgraphs__ must be an object.");
  }

  for (const [rawId, rawSubgraph] of Object.entries(rawRegistry)) {
    const normalizedId = normalizeCode(rawId);
    if (!normalizedId) {
      throw new Error("Graph definition contains an empty subgraph id.");
    }

    const rootNodeId = normalizeCode(rawSubgraph?.rootNodeId || "");
    if (!rootNodeId) {
      throw new Error(
        `Subgraph "${normalizedId}" must declare a non-empty rootNodeId.`,
      );
    }

    const terminalNodeId = normalizeCode(rawSubgraph?.terminalNodeId || "");
    if (!terminalNodeId) {
      throw new Error(
        `Subgraph "${normalizedId}" must declare a non-empty terminalNodeId.`,
      );
    }

    normalizedRegistry[normalizedId] = {
      rootNodeId,
      terminalNodeId,
    };
  }

  return normalizedRegistry;
}

function validateSubgraphRegistry(
  nodes: Graph.Node[],
  nodesById: Record<string, GraphTopologyNode>,
  subgraphsById: Graph.SubgraphRegistry,
): void {
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const [subgraphId, subgraph] of Object.entries(subgraphsById)) {
    const rootNode = nodesById[subgraph.rootNodeId]?.node || null;
    if (!rootNode || !nodeIds.has(rootNode.id)) {
      throw new Error(
        `Subgraph "${subgraphId}" references unknown root node "${subgraph.rootNodeId}".`,
      );
    }

    const terminalNode = nodesById[subgraph.terminalNodeId]?.node || null;
    if (!terminalNode || !nodeIds.has(terminalNode.id)) {
      throw new Error(
        `Subgraph "${subgraphId}" references unknown terminal node "${subgraph.terminalNodeId}".`,
      );
    }

    if (normalizeCode(rootNode.group || "") !== subgraphId) {
      throw new Error(
        `Subgraph "${subgraphId}" root node "${rootNode.id}" must belong to group "${subgraphId}".`,
      );
    }

    if (normalizeCode(terminalNode.group || "") !== subgraphId) {
      throw new Error(
        `Subgraph "${subgraphId}" terminal node "${terminalNode.id}" must belong to group "${subgraphId}".`,
      );
    }

    const reachableFromRoot = collectReachableIds(
      subgraph.rootNodeId,
      nodesById,
      "next",
    );
    if (!reachableFromRoot.has(subgraph.terminalNodeId)) {
      throw new Error(
        `Subgraph "${subgraphId}" terminal node "${subgraph.terminalNodeId}" is unreachable from root "${subgraph.rootNodeId}".`,
      );
    }

    const boundedSubgraphNodeIds = collectBoundedReachableIds(
      subgraph.rootNodeId,
      subgraph.terminalNodeId,
      nodesById,
    );
    const escapedNodeIds = Array.from(boundedSubgraphNodeIds).filter(
      (nodeId) => {
        const node = nodesById[nodeId]?.node || null;

        return normalizeCode(node?.group || "") !== subgraphId;
      },
    );

    if (escapedNodeIds.length > 0) {
      throw new Error(
        `Subgraph "${subgraphId}" may execute nodes outside group "${subgraphId}": ${formatCodeList(escapedNodeIds)}.`,
      );
    }
  }
}

function validateDeclaredSubgraphCalls(
  nodes: Graph.Node[],
  subgraphsById: Graph.SubgraphRegistry,
): void {
  const declaredSubgraphIds = new Set(Object.keys(subgraphsById));

  for (const node of nodes) {
    for (const subgraphId of node.subgraphCalls || []) {
      if (!declaredSubgraphIds.has(subgraphId)) {
        throw new Error(
          `Graph node "${node.id}" references undeclared subgraph "${subgraphId}".`,
        );
      }
    }
  }
}

function createGraphView(
  definition: Graph.Definition,
  nodesById: Record<string, GraphTopologyNode>,
  topologicalOrder: Graph.Node[],
  subgraphsById: Graph.SubgraphRegistry,
): Graph.View {
  return {
    definition,
    getChildren(id: string): Graph.Node[] {
      const node = this.getNode(id);
      if (!node) {
        return [];
      }

      return (node.next || [])
        .map((childId) => this.getNode(childId))
        .filter((childNode): childNode is Graph.Node => !!childNode);
    },
    getNode(id: string): Graph.Node | null {
      const normalizedId = normalizeCode(id);
      const node = definition[normalizedId];

      return isGraphNodeEntry(node) ? node : null;
    },
    getParents(id: string): Graph.Node[] {
      const normalizedId = normalizeCode(id);
      const entry = nodesById[normalizedId];

      return entry
        ? entry.parentIds
            .map((parentId) => {
              const parentNode = definition[parentId];

              return isGraphNodeEntry(parentNode) ? parentNode : null;
            })
            .filter((parentNode): parentNode is Graph.Node => !!parentNode)
        : [];
    },
    getRoot(): Graph.Node | null {
      return isGraphNodeEntry(definition.ROOT) ? definition.ROOT : null;
    },
    getTerminal(): Graph.Node | null {
      return isGraphNodeEntry(definition.TERMINAL) ? definition.TERMINAL : null;
    },
    getTopologicalOrder(): Graph.Node[] {
      return topologicalOrder.slice();
    },
    getSubgraph(id: string): Graph.Subgraph | null {
      const normalizedId = normalizeCode(id);

      return subgraphsById[normalizedId] || null;
    },
    getSubgraphIds(): string[] {
      return Object.keys(subgraphsById);
    },
  };
}

function buildGraphView(definition: Graph.Definition): Graph.View {
  const normalizedEntries = normalizeDefinitionEntries(definition);
  const normalizedSubgraphs = normalizeSubgraphRegistry(definition);
  const normalizedDefinition: Graph.Definition = Object.create(null);
  const nodesById: Record<string, GraphTopologyNode> = Object.create(null);
  const nodes = normalizedEntries.map(([id, node]) => {
    normalizedDefinition[id] = node;
    nodesById[id] = {
      node,
      parentIds: [],
    };

    return node;
  });

  for (const node of nodes) {
    for (const childId of node.next || []) {
      const childEntry = nodesById[childId];
      if (!childEntry) {
        throw new Error(
          `Graph node "${node.id}" references missing child "${childId}".`,
        );
      }

      if (!childEntry.parentIds.includes(node.id)) {
        childEntry.parentIds.push(node.id);
      }
    }
  }

  const topologicalOrder = buildTopologicalOrder(nodes, nodesById);
  const root = requireSingleBoundaryNode(
    "root",
    nodes.filter((node) => (nodesById[node.id]?.parentIds.length || 0) === 0),
  );
  const terminal = requireSingleBoundaryNode(
    "terminal",
    nodes.filter((node) => (node.next || []).length === 0),
  );

  const reachableFromRoot = collectReachableIds(root.id, nodesById, "next");
  if (reachableFromRoot.size !== nodes.length) {
    const unreachableIds = nodes
      .map((node) => node.id)
      .filter((id) => !reachableFromRoot.has(id));
    throw new Error(
      `Graph has nodes unreachable from the root "${root.id}": ${formatCodeList(unreachableIds)}.`,
    );
  }

  const idsReachingTerminal = collectReachableIds(
    terminal.id,
    nodesById,
    "parentIds",
  );
  if (idsReachingTerminal.size !== nodes.length) {
    const deadEndIds = nodes
      .map((node) => node.id)
      .filter((id) => !idsReachingTerminal.has(id));
    throw new Error(
      `Graph has nodes that cannot reach the terminal "${terminal.id}": ${formatCodeList(deadEndIds)}.`,
    );
  }

  validateSubgraphRegistry(nodes, nodesById, normalizedSubgraphs);
  validateDeclaredSubgraphCalls(nodes, normalizedSubgraphs);

  if (Object.keys(normalizedSubgraphs).length > 0) {
    normalizedDefinition.__subgraphs__ = normalizedSubgraphs;
  }

  return createGraphView(
    normalizedDefinition,
    nodesById,
    topologicalOrder,
    normalizedSubgraphs,
  );
}

function requireGraphNodeSpec(graph: Graph.View, code: string): Graph.Node {
  const normalizedCode = normalizeCode(code);
  const graphNode = graph.getNode(normalizedCode);

  if (!graphNode) {
    throw new Error(`Unknown runtime graph node "${normalizedCode}".`);
  }

  return graphNode;
}

function isTerminalNodeId(code: string): boolean {
  return normalizeCode(code) === "TERMINAL";
}

function formatSubgraphTraceBoundary(subgraphId: string): string {
  return `SUBGRAPH:${normalizeCode(subgraphId)}`;
}

export type ResolverRegistry = Record<string, ResolverConstructor | undefined>;

export interface ResolverConstructor {
  new(code: string): Resolver;
}

export class ResolveFlow {
  readonly graph: Graph.View;
  #subgraphsById: Graph.SubgraphRegistry;
  #nodesByCode: Record<string, Resolver>;

  constructor(
    definition: Graph.Definition,
    resolverClassesByName: ResolverRegistry,
    resolverEnv?: unknown,
  ) {
    this.graph = buildGraphView(definition);
    this.#subgraphsById = Object.create(null);
    for (const subgraphId of this.graph.getSubgraphIds()) {
      const subgraph = this.graph.getSubgraph(subgraphId);
      if (subgraph) {
        this.#subgraphsById[subgraphId] = subgraph;
      }
    }
    const resolverSpecsByCode: Record<string, string> = Object.create(null);
    for (const node of this.graph.getTopologicalOrder()) {
      if (isPlanResolverClass(node.type) || isTerminalNodeId(node.id)) {
        continue;
      }

      resolverSpecsByCode[node.id] = node.type;
    }

    this.#nodesByCode = Object.create(null);
    Object.keys(resolverSpecsByCode).forEach((code) => {
      const normalizedCode = normalizeCode(code);
      const resolverClass = resolverSpecsByCode[code] as string;
      const ResolverCtor = resolverClassesByName[resolverClass] || null;

      if (!ResolverCtor) {
        throw new Error(
          `Unknown resolver class "${String(resolverClass || "")}" for "${normalizedCode}".`,
        );
      }

      const resolver = new ResolverCtor(normalizedCode);

      if (resolverEnv !== undefined && typeof resolver.initEnv === "function") {
        resolver.initEnv(resolverEnv);
      }

      this.#nodesByCode[normalizedCode] = resolver;
    });

    for (const node of this.graph.getTopologicalOrder()) {
      if (isPlanResolverClass(node.type)) {
        this.#getRuntimeNode(node.id);
      }
    }
  }

  getGraph(): Graph.View {
    return this.graph;
  }

  getResolver(id: string): Resolver | null {
    const normalizedId = normalizeCode(id);
    if (isTerminalNodeId(normalizedId)) {
      return null;
    }
    if (!this.graph.getNode(normalizedId)) {
      return null;
    }
    return this.#getRuntimeNode(normalizedId);
  }

  callSubgraph(
    subgraphId: string,
    inputValue: unknown,
    trace?: ExecutionTrace,
  ): LookupResult {
    const normalizedSubgraphId = normalizeCode(subgraphId);
    const subgraph = this.#subgraphsById[normalizedSubgraphId];
    const executionTrace = trace || {
      visitedNodeIds: [],
      subgraphCallTraces: [],
    };

    if (!subgraph) {
      throw new Error(`Unknown subgraph "${normalizedSubgraphId}".`);
    }

    const segmentStartIndex = executionTrace.visitedNodeIds.length;

    executionTrace.visitedNodeIds.push(
      formatSubgraphTraceBoundary(normalizedSubgraphId),
    );

    const engine = new FlowEngine(this);
    const engineResult = engine.executeBounded(
      subgraph.rootNodeId,
      subgraph.terminalNodeId,
      { value: inputValue as object },
      executionTrace,
    );
    const path = executionTrace.visitedNodeIds
      .slice(segmentStartIndex)
      .filter((visitedNodeId) => visitedNodeId !== "TERMINAL");
    const route = path.join(" -> ");
    const status =
      engineResult.status === EnvelopeStatus.Success ? "success" : "failure";

    if (!Array.isArray(executionTrace.subgraphCallTraces)) {
      executionTrace.subgraphCallTraces = [];
    }

    const error = String(engineResult.error || "").trim();
    executionTrace.subgraphCallTraces.push({
      ...(error ? { error } : {}),
      path,
      route,
      status,
      subgraphId: normalizedSubgraphId,
    });

    if (engineResult.status !== EnvelopeStatus.Success) {
      return {
        ...(error ? { error } : {}),
        route,
        status: "failure",
        value: null,
      };
    }

    return {
      route,
      status: "success",
      value: engineResult.value,
    };
  }

  #getRuntimeNode(code: string): Resolver {
    const normalizedCode = normalizeCode(code);
    const existingNode = this.#nodesByCode[normalizedCode];

    if (existingNode) {
      return existingNode;
    }

    const spec = requireGraphNodeSpec(this.graph, normalizedCode);

    if (isTerminalNodeId(spec.id)) {
      throw new Error(
        `Runtime graph terminal node "${normalizedCode}" is not executable.`,
      );
    }

    if (!isPlanResolverClass(spec.type)) {
      throw new Error(
        `Resolver node "${normalizedCode}" was not materialized during graph compilation.`,
      );
    }

    const compiledNode = buildPlanNodeFromSpec(
      normalizedCode,
      spec,
      (nodeCode) =>
        isTerminalNodeId(nodeCode) ? null : this.#getRuntimeNode(nodeCode),
    );

    this.#nodesByCode[normalizedCode] = compiledNode;

    return compiledNode;
  }
}
