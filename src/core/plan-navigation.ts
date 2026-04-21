import { type FlowNode, FlowJunction } from "./resolver-classes";
import { NodeKind } from "./flow";

function formatNodeName(node: FlowNode | null | undefined): string {
  return String((node && node.id) || "").trim() || "<unknown>";
}

export function isResolverPlan(node: unknown): node is FlowJunction {
  return (
    !!node && typeof (node as FlowJunction).getHandleableNodes === "function"
  );
}

export function selectSinglePlanNode<TNode extends FlowNode>(
  plan: Pick<FlowJunction, "getHandleableNodes" | "id"> | null | undefined,
  request: unknown,
  options: {
    allowNone?: boolean;
    onMultiple?: (selectedNodes: TNode[]) => Error;
    onNone?: () => Error;
  } = {},
): TNode | null {
  const selectedNodes = plan
    ? (plan.getHandleableNodes(request) as TNode[])
    : [];

  if (!selectedNodes.length) {
    if (options.allowNone === true) {
      return null;
    }

    throw options.onNone
      ? options.onNone()
      : new Error(
          `Resolver plan "${String((plan && plan.id) || "")}" matched no nodes.`,
        );
  }

  if (selectedNodes.length > 1) {
    throw options.onMultiple
      ? options.onMultiple(selectedNodes)
      : new Error(
          `Resolver plan "${String((plan && plan.id) || "")}" matched multiple nodes: ${selectedNodes
            .map(formatNodeName)
            .join(", ")}.`,
        );
  }

  return selectedNodes[0] ?? null;
}

export function resolveRoutingNode<TNode extends FlowNode>(
  node: FlowNode | null | undefined,
  request: unknown,
  options: {
    allowNone?: boolean;
    onMultiple?: (routingNode: FlowJunction, selectedNodes: TNode[]) => Error;
    onNone?: (routingNode: FlowJunction) => Error;
  } = {},
): TNode | FlowNode | null {
  let currentNode = node;

  while (
    isResolverPlan(currentNode) &&
    [NodeKind.Step, NodeKind.Switch].includes(
      currentNode.getNodeKind(),
    )
  ) {
    const routingNode = currentNode;

    currentNode = selectSinglePlanNode<TNode>(routingNode, request, {
      allowNone: options.allowNone === true,
      onNone: () =>
        options.onNone
          ? options.onNone(routingNode)
          : new Error(
              `Resolver plan "${String((routingNode && routingNode.id) || "")}" matched no nodes.`,
            ),
      onMultiple: (selectedNodes) =>
        options.onMultiple
          ? options.onMultiple(routingNode, selectedNodes)
          : new Error(
              `Resolver plan "${String((routingNode && routingNode.id) || "")}" matched multiple nodes.`,
            ),
    });

    if (!currentNode) {
      return null;
    }
  }

  return currentNode || null;
}

export function matchesResolverName(
  node: Pick<FlowNode, "id"> | null | undefined,
  name: string,
): boolean {
  const normalizedName = String(name || "")
    .trim()
    .toUpperCase();

  return !!(
    normalizedName &&
    node &&
    String(node.id || "")
      .trim()
      .toUpperCase() === normalizedName
  );
}

function listSearchablePlanNodes(
  node: FlowJunction | null | undefined,
  request: unknown | null,
): FlowNode[] {
  if (!node) {
    return [];
  }

  return (node.nodes || []).filter((childNode: FlowNode) => {
    if (!request) {
      return true;
    }

    return childNode.canHandle(request);
  });
}

export function findNamedResolver(
  node: FlowNode | null | undefined,
  name: string,
  request: unknown | null,
  options: { requireCanHandle?: boolean } = {},
): FlowNode | null {
  const requireCanHandle = options.requireCanHandle !== false;
  let nodes: FlowNode[];

  if (!node || !name) {
    return null;
  }

  if (requireCanHandle && request && !node.canHandle(request)) {
    return null;
  }

  if (matchesResolverName(node, name)) {
    return node;
  }

  if (!isResolverPlan(node)) {
    return null;
  }

  nodes =
    requireCanHandle && request
      ? listSearchablePlanNodes(node, request)
      : ((node.nodes || []) as FlowNode[]);

  for (const childNode of nodes) {
    const found = findNamedResolver(childNode, name, request, options);
    if (found) {
      return found;
    }
  }

  return null;
}
