import {
  type PlanSpec,
  getPlanSpecNodeCodes,
  normalizePlanSpecCode,
} from "./plan-specs";

export interface PlanSpecDagNode {
  code: string;
  spec: PlanSpec;
  parentCodes: string[];
  childCodes: string[];
}

export interface PlanSpecDagEdge {
  parentCode: string;
  childCode: string;
}

export interface PlanSpecDag {
  nodesByCode: Record<string, PlanSpecDagNode>;
  nodes: PlanSpecDagNode[];
  edges: PlanSpecDagEdge[];
  topologicalOrder: PlanSpecDagNode[];
}

export interface HoodleFinancePlanSpecDag extends PlanSpecDag {
  root: PlanSpecDagNode;
  terminal: PlanSpecDagNode;
}

function formatCodeList(codes: string[]): string {
  return codes.join(", ");
}

function normalizePlanSpecEntries(
  planSpecsByCode: Record<string, PlanSpec>,
): Array<[string, PlanSpec]> {
  const normalizedEntries: Array<[string, PlanSpec]> = [];
  const originalCodeByNormalizedCode: Record<string, string> =
    Object.create(null);

  for (const [code, spec] of Object.entries(planSpecsByCode)) {
    const normalizedCode = normalizePlanSpecCode(code);
    if (!normalizedCode) {
      throw new Error(
        `Plan spec DAG contains an empty node code from key ${JSON.stringify(code)}.`,
      );
    }

    const existingCode = originalCodeByNormalizedCode[normalizedCode];
    if (existingCode) {
      throw new Error(
        `Plan spec DAG contains duplicate normalized code "${normalizedCode}" from keys ${JSON.stringify(existingCode)} and ${JSON.stringify(code)}.`,
      );
    }

    originalCodeByNormalizedCode[normalizedCode] = code;
    normalizedEntries.push([normalizedCode, spec]);
  }

  if (normalizedEntries.length === 0) {
    throw new Error("Plan spec DAG must contain at least one node.");
  }

  return normalizedEntries;
}

function buildTopologicalOrder(
  nodes: PlanSpecDagNode[],
  nodesByCode: Record<string, PlanSpecDagNode>,
): PlanSpecDagNode[] {
  const topologicalOrder: PlanSpecDagNode[] = [];
  const queue = nodes.filter((node) => node.parentCodes.length === 0);
  const remainingParentCount: Record<string, number> = Object.create(null);

  for (const node of nodes) {
    remainingParentCount[node.code] = node.parentCodes.length;
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }

    topologicalOrder.push(node);
    for (const childCode of node.childCodes) {
      const childNode = nodesByCode[childCode];
      if (!childNode) {
        continue;
      }
      const nextParentCount = (remainingParentCount[childCode] || 0) - 1;
      remainingParentCount[childCode] = nextParentCount;
      if (nextParentCount === 0) {
        queue.push(childNode);
      }
    }
  }

  if (topologicalOrder.length !== nodes.length) {
    const orderedCodes = new Set(topologicalOrder.map((node) => node.code));
    const cycleCodes = nodes
      .map((node) => node.code)
      .filter((code) => !orderedCodes.has(code));
    throw new Error(
      `Plan spec DAG contains a cycle involving: ${formatCodeList(cycleCodes)}.`,
    );
  }

  return topologicalOrder;
}

function requireSingleBoundaryNode(
  kind: "root" | "terminal",
  nodes: PlanSpecDagNode[],
): PlanSpecDagNode {
  const firstNode = nodes[0];
  if (nodes.length === 1 && firstNode) {
    return firstNode;
  }

  const description =
    nodes.length > 0
      ? `: ${formatCodeList(nodes.map((node) => node.code))}`
      : "";
  throw new Error(
    `Plan spec DAG must have exactly one ${kind}; found ${nodes.length}${description}.`,
  );
}

function collectReachableCodes(
  startCode: string,
  nodesByCode: Record<string, PlanSpecDagNode>,
  relation: "childCodes" | "parentCodes",
): Set<string> {
  const visited = new Set<string>();
  const queue = [startCode];

  while (queue.length > 0) {
    const code = queue.shift();
    if (!code || visited.has(code)) {
      continue;
    }

    visited.add(code);
    const node = nodesByCode[code];
    if (!node) {
      continue;
    }

    for (const relatedCode of node[relation]) {
      if (!visited.has(relatedCode)) {
        queue.push(relatedCode);
      }
    }
  }

  return visited;
}

export function instantiatePlanSpecDag(
  planSpecsByCode: Record<string, PlanSpec>,
): PlanSpecDag {
  const normalizedEntries = normalizePlanSpecEntries(planSpecsByCode);
  const nodesByCode: Record<string, PlanSpecDagNode> = Object.create(null);
  const nodes = normalizedEntries.map(([code, spec]) => {
    const node: PlanSpecDagNode = {
      childCodes: [],
      code,
      parentCodes: [],
      spec,
    };
    nodesByCode[code] = node;
    return node;
  });
  const edges: PlanSpecDagEdge[] = [];

  for (const node of nodes) {
    const childCodes = getPlanSpecNodeCodes(node.spec);
    for (const childCode of childCodes) {
      const childNode = nodesByCode[childCode];
      if (!childNode) {
        throw new Error(
          `Plan spec DAG node "${node.code}" references missing child "${childCode}".`,
        );
      }

      node.childCodes.push(childCode);
      if (!childNode.parentCodes.includes(node.code)) {
        childNode.parentCodes.push(node.code);
      }
      edges.push({ childCode, parentCode: node.code });
    }
  }

  const topologicalOrder = buildTopologicalOrder(nodes, nodesByCode);
  return {
    edges,
    nodes,
    nodesByCode,
    topologicalOrder,
  };
}

export function hoodleFinanceDagStructureValidation(
  dag: PlanSpecDag,
): HoodleFinancePlanSpecDag {
  const root = requireSingleBoundaryNode(
    "root",
    dag.nodes.filter((node) => node.parentCodes.length === 0),
  );
  const terminal = requireSingleBoundaryNode(
    "terminal",
    dag.nodes.filter((node) => node.childCodes.length === 0),
  );

  const reachableFromRoot = collectReachableCodes(
    root.code,
    dag.nodesByCode,
    "childCodes",
  );
  if (reachableFromRoot.size !== dag.nodes.length) {
    const unreachableCodes = dag.nodes
      .map((node) => node.code)
      .filter((code) => !reachableFromRoot.has(code));
    throw new Error(
      `Plan spec DAG has nodes unreachable from the root "${root.code}": ${formatCodeList(unreachableCodes)}.`,
    );
  }

  const codesReachingTerminal = collectReachableCodes(
    terminal.code,
    dag.nodesByCode,
    "parentCodes",
  );
  if (codesReachingTerminal.size !== dag.nodes.length) {
    const deadEndCodes = dag.nodes
      .map((node) => node.code)
      .filter((code) => !codesReachingTerminal.has(code));
    throw new Error(
      `Plan spec DAG has nodes that cannot reach the terminal "${terminal.code}": ${formatCodeList(deadEndCodes)}.`,
    );
  }

  return {
    ...dag,
    root,
    terminal,
  };
}

export function instantiateHoodleFinancePlanSpecDag(
  planSpecsByCode: Record<string, PlanSpec>,
): HoodleFinancePlanSpecDag {
  return hoodleFinanceDagStructureValidation(
    instantiatePlanSpecDag(planSpecsByCode),
  );
}
