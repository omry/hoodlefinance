import type { RequestInput, ResolvedRequest } from "./request";
import type { ResolverNode, ResolverPlanNode } from "./planner";

export interface SelectSinglePlanNodeOptions<TNode extends ResolverNode> {
  allowNone?: boolean;
  onMultiple?: (selectedNodes: TNode[]) => Error;
  onNone?: () => Error;
}

export interface ResolveRoutingNodeOptions<TNode extends ResolverNode> {
  allowNone?: boolean;
  onMultiple?: (routingNode: ResolverPlanNode, selectedNodes: TNode[]) => Error;
  onNone?: (routingNode: ResolverPlanNode) => Error;
}

export interface FindNamedResolverNodeOptions {
  requireCanHandle?: boolean;
}

function formatNodeName(node: ResolverNode | null | undefined): string {
  return String((node && node.name) || "").trim() || "<unknown>";
}

export function isResolverPlanNode(node: unknown): node is ResolverPlanNode {
  return (
    !!node &&
    typeof (node as ResolverPlanNode).getNodesForRequest === "function"
  );
}

export function selectSinglePlanNode<TNode extends ResolverNode>(
  plan:
    | Pick<ResolverPlanNode, "getNodesForRequest" | "name">
    | null
    | undefined,
  request: RequestInput | ResolvedRequest,
  options: SelectSinglePlanNodeOptions<TNode> = {},
): TNode | null {
  const selectedNodes = plan
    ? (plan.getNodesForRequest(request) as TNode[])
    : [];

  if (!selectedNodes.length) {
    if (options.allowNone === true) {
      return null;
    }

    throw options.onNone
      ? options.onNone()
      : new Error(
          `Resolver plan "${String((plan && plan.name) || "")}" matched no nodes.`,
        );
  }

  if (selectedNodes.length > 1) {
    throw options.onMultiple
      ? options.onMultiple(selectedNodes)
      : new Error(
          `Resolver plan "${String((plan && plan.name) || "")}" matched multiple nodes: ${selectedNodes
            .map(formatNodeName)
            .join(", ")}.`,
        );
  }

  return selectedNodes[0] ?? null;
}

export function resolveRoutingNode<TNode extends ResolverNode>(
  node: ResolverNode | null | undefined,
  request: RequestInput | ResolvedRequest,
  options: ResolveRoutingNodeOptions<TNode> = {},
): TNode | ResolverNode | null {
  let currentNode = node;

  while (isResolverPlanNode(currentNode) && currentNode.getRoutingNodeKind() === "switch") {
    const routingNode = currentNode;

    currentNode = selectSinglePlanNode<TNode>(routingNode, request, {
      allowNone: options.allowNone === true,
      onNone: () =>
        options.onNone
          ? options.onNone(routingNode)
          : new Error(
              `Resolver plan "${String((routingNode && routingNode.name) || "")}" matched no nodes.`,
            ),
      onMultiple: (selectedNodes) =>
        options.onMultiple
          ? options.onMultiple(routingNode, selectedNodes)
          : new Error(
              `Resolver plan "${String((routingNode && routingNode.name) || "")}" matched multiple nodes.`,
            ),
    });

    if (!currentNode) {
      return null;
    }
  }

  return currentNode || null;
}

export function matchesResolverNodeName(
  node: Pick<ResolverNode, "name"> | null | undefined,
  name: string,
): boolean {
  const normalizedName = String(name || "")
    .trim()
    .toUpperCase();

  return !!(
    normalizedName &&
    node &&
    String(node.name || "")
      .trim()
      .toUpperCase() === normalizedName
  );
}

export function listSearchablePlanNodes(
  node: ResolverPlanNode | null | undefined,
  request: RequestInput | ResolvedRequest | null,
): ResolverNode[] {
  if (!node) {
    return [];
  }

  return (node.nodes || []).filter((childNode) => {
    if (!childNode?.canHandle || !request) {
      return true;
    }

    return childNode.canHandle(request);
  });
}

export function findNamedResolverNode(
  node: ResolverNode | null | undefined,
  name: string,
  request: RequestInput | ResolvedRequest | null,
  options: FindNamedResolverNodeOptions = {},
): ResolverNode | null {
  const requireCanHandle = options.requireCanHandle !== false;
  let nodes: ResolverNode[];

  if (!node || !name) {
    return null;
  }

  if (
    requireCanHandle &&
    request &&
    node.canHandle &&
    !node.canHandle(request)
  ) {
    return null;
  }

  if (matchesResolverNodeName(node, name)) {
    return node;
  }

  if (!isResolverPlanNode(node)) {
    return null;
  }

  nodes =
    requireCanHandle && request
      ? listSearchablePlanNodes(node, request)
      : ((node.nodes || []) as ResolverNode[]);

  for (const childNode of nodes) {
    const found = findNamedResolverNode(childNode, name, request, options);
    if (found) {
      return found;
    }
  }

  return null;
}
