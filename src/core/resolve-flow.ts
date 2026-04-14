import { isResolverPlan } from "./plan-navigation";
import { type Graph, getGraphNodeNextIds, normalizeGraphNodeId } from "./graph";
import type { Resolver, ResolverPlan } from "./resolver-classes";
import { RawRequestInput } from "./request";
import { extractAttributeValue } from "./attribute-extraction";
import { resolveIsinAttributeValue } from "./isin-lookup";
import { type PlanRuntimeRefs } from "./core-resolvers";
import {
  buildPlanNodeFromSpec,
  PLAN_RESOLVER_CLASSES_BY_NAME,
} from "./resolver-classes";
import {
  materializeResolversByCode,
  type ResolverMaterializationDependencies,
} from "./resolver-materialization";
import type { RequestResolutionDependencies } from "./request-resolution";
import { createRequestResolutionEnv } from "./request-resolution-env";
import { FlowEngine, EnvelopeStatus } from "./flow-engine";

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

function normalizeDefinitionEntries(
  definition: Graph.Definition,
): Array<[string, Graph.Node]> {
  const normalizedEntries: Array<[string, Graph.Node]> = [];
  const originalKeyByNormalizedKey: Record<string, string> = Object.create(null);

  for (const [key, rawNode] of Object.entries(definition || {})) {
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
    const nextIds = getGraphNodeNextIds(rawNode as Graph.Node);

    if (nextIds.length > 0) {
      normalizedNode.next = nextIds;
    }

    const group = String((rawNode as Graph.Node)?.group || "").trim();
    if (group) {
      normalizedNode.group = group;
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
      relation === "next" ? (entry.node.next || []) : entry.parentIds;
    for (const relatedId of relatedIds) {
      if (!visited.has(relatedId)) {
        queue.push(relatedId);
      }
    }
  }

  return visited;
}

function createGraphView(
  definition: Graph.Definition,
  nodesById: Record<string, GraphTopologyNode>,
  topologicalOrder: Graph.Node[],
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

      return definition[normalizedId] || null;
    },
    getParents(id: string): Graph.Node[] {
      const normalizedId = normalizeCode(id);
      const entry = nodesById[normalizedId];

      return entry
        ? entry.parentIds
            .map((parentId) => definition[parentId] || null)
            .filter((parentNode): parentNode is Graph.Node => !!parentNode)
        : [];
    },
    getRoot(): Graph.Node | null {
      return definition.ROOT || null;
    },
    getTerminal(): Graph.Node | null {
      return definition.TERMINAL || null;
    },
    getTopologicalOrder(): Graph.Node[] {
      return topologicalOrder.slice();
    },
  };
}

function buildGraphView(definition: Graph.Definition): Graph.View {
  const normalizedEntries = normalizeDefinitionEntries(definition);
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

  return createGraphView(normalizedDefinition, nodesById, topologicalOrder);
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

export interface ResolveFlowDependencies
  extends ResolverMaterializationDependencies {
  looksLikeIsin(value: string): boolean;
}


export class ResolveFlow {
  readonly graph: Graph.View;
  private readonly runtimeRefs: PlanRuntimeRefs;
  private readonly resolutionEnv: RequestResolutionDependencies | null;
  #nodesByCode: Record<string, Resolver>;

  constructor(definition: Graph.Definition, deps: ResolveFlowDependencies) {
    this.graph = buildGraphView(definition);
    this.#nodesByCode = Object.create(null);
    this.runtimeRefs = {
      getFxPlan: () => this.#getRuntimePlanNode("ATTRIBUTE:FX"),
    };

    const resolverSpecsByCode: Record<string, string> = Object.create(null);
    for (const node of this.graph.getTopologicalOrder()) {
      if (isPlanResolverClass(node.type) || isTerminalNodeId(node.id)) {
        continue;
      }

      resolverSpecsByCode[node.id] = node.type;
    }

    const resolverRegistry = materializeResolversByCode(
      resolverSpecsByCode,
      deps,
    );
    Object.assign(this.#nodesByCode, resolverRegistry.byCode);

    for (const node of this.graph.getTopologicalOrder()) {
      if (isPlanResolverClass(node.type)) {
        this.#getRuntimeNode(node.id);
      }
    }

    const supportsRuntimeLookup =
      !!this.graph.getNode("ROOT") &&
      !!this.graph.getNode("ATTRIBUTE") &&
      !!this.graph.getNode("IDENTIFIER:ISIN") &&
      !!this.graph.getNode("ATTRIBUTE:FX");

    if (!supportsRuntimeLookup) {
      this.resolutionEnv = null;
      return;
    }

    this.resolutionEnv = createRequestResolutionEnv(
      {
        defaultAttributeRoot: this.#getRuntimePlanNode("ATTRIBUTE"),
        identifierPlan: this.#getRuntimePlanNode("IDENTIFIER:ISIN"),
        rootClassifier: this.#getRuntimeNode("ROOT") as {
          resolve(
            requestInput: import("./request").RawRequestInput,
          ): import("./planner").ResolutionResult<import("./concrete-resolvers").ClassifiedInput>;
        },
      },
      {
        looksLikeIsin: deps.looksLikeIsin,
        ...(deps.resolverServices
          ? { resolverServices: deps.resolverServices }
          : {}),
      },
    );
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

  private requireResolutionEnv(): RequestResolutionDependencies {
    if (!this.resolutionEnv) {
      throw new Error(
        "ResolveFlow does not include the HOODLEFINANCE runtime entry nodes required for lookup.",
      );
    }

    return this.resolutionEnv;
  }

  private createRawRequestInput(
    identifier: string,
    attribute?: string,
  ): RawRequestInput {
    return new RawRequestInput(
      String(identifier || ""),
      String(attribute == null ? "price" : attribute).trim(),
    );
  }

  private projectFlowEngineValue(
    rawInput: RawRequestInput,
    flowValue: unknown,
  ): unknown {
    if (flowValue == null || typeof flowValue !== "object") {
      return flowValue;
    }

    const env = this.requireResolutionEnv();
    const lookupSelection = env.selectLookupExecution(rawInput);
    const requestInput = lookupSelection.requestInput;
    const routeState =
      lookupSelection.attributePlan &&
      lookupSelection.resolvedRequest &&
      typeof lookupSelection.attributePlan.buildRuntimePlan === "function"
        ? lookupSelection.attributePlan
            .buildRuntimePlan(lookupSelection.resolvedRequest)
            .routeState || null
        : null;
    const quote = flowValue as Record<string, unknown>;

    if (requestInput.attributeType === "isin") {
      return resolveIsinAttributeValue(
        quote,
        { tickerInput: requestInput.ticker },
        {
          fetchText: (url) => env.httpFetch(url).getContentText(),
          getCachedString: env.getCachedString,
          looksLikeIsin: env.looksLikeIsin,
          putCachedString: env.putCachedString,
        },
      );
    }

    return extractAttributeValue(
      quote,
      requestInput.attribute,
      {
        routeState,
        tickerInput: requestInput.ticker,
      },
    );
  }

  resolveAttribute(identifier: string, attribute = "price"): unknown {
    const rawInput = this.createRawRequestInput(identifier, attribute);
    const engine = new FlowEngine(this);
    const engineResult = engine.execute({ value: rawInput });

    if (engineResult.status !== EnvelopeStatus.Success) {
      throw new Error("Lookup failed.");
    }

    return this.projectFlowEngineValue(rawInput, engineResult.value);
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
      null,
      this.runtimeRefs,
    );

    this.#nodesByCode[normalizedCode] = compiledNode;

    return compiledNode;
  }

  #getRuntimePlanNode(code: string): ResolverPlan {
    const node = this.#getRuntimeNode(code);

    if (!isResolverPlan(node)) {
      throw new Error(
        `Runtime graph node "${normalizeCode(code)}" is not a resolver plan node.`,
      );
    }

    return node;
  }
}
