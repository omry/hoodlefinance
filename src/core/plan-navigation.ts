import { type Resolver, ResolverPlan } from "./resolver-classes";
import { RoutingNodeKind } from "./planner";

interface SelectSinglePlanNodeOptions<TNode extends Resolver> {
  allowNone?: boolean;
  onMultiple?: (selectedNodes: TNode[]) => Error;
  onNone?: () => Error;
}

interface ResolveRoutingNodeOptions<TNode extends Resolver> {
  allowNone?: boolean;
  onMultiple?: (routingNode: ResolverPlan, selectedNodes: TNode[]) => Error;
  onNone?: (routingNode: ResolverPlan) => Error;
}

interface FindNamedResolverOptions {
  requireCanHandle?: boolean;
}

function formatNodeName(node: Resolver | null | undefined): string {
  return String((node && node.name) || "").trim() || "<unknown>";
}

export function isResolverPlan(node: unknown): node is ResolverPlan {
  return (
    !!node &&
    typeof (node as ResolverPlan).getNodesForRequest === "function"
  );
}

export function selectSinglePlanNode<TNode extends Resolver>(
  plan:
    | Pick<ResolverPlan, "getNodesForRequest" | "name">
    | null
    | undefined,
  request: unknown,
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

export function resolveRoutingNode<TNode extends Resolver>(
  node: Resolver | null | undefined,
  request: unknown,
  options: ResolveRoutingNodeOptions<TNode> = {},
): TNode | Resolver | null {
  let currentNode = node;

  while (
    isResolverPlan(currentNode) &&
    [RoutingNodeKind.Step, RoutingNodeKind.Switch].includes(
      currentNode.getRoutingNodeKind(),
    )
  ) {
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

export function matchesResolverName(
  node: Pick<Resolver, "name"> | null | undefined,
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

function listSearchablePlanNodes(
  node: ResolverPlan | null | undefined,
  request: unknown | null,
): Resolver[] {
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

export function findNamedResolver(
  node: Resolver | null | undefined,
  name: string,
  request: unknown | null,
  options: FindNamedResolverOptions = {},
): Resolver | null {
  const requireCanHandle = options.requireCanHandle !== false;
  let nodes: Resolver[];

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

  if (matchesResolverName(node, name)) {
    return node;
  }

  if (!isResolverPlan(node)) {
    return null;
  }

  nodes =
    requireCanHandle && request
      ? listSearchablePlanNodes(node, request)
      : ((node.nodes || []) as Resolver[]);

  for (const childNode of nodes) {
    const found = findNamedResolver(childNode, name, request, options);
    if (found) {
      return found;
    }
  }

  return null;
}
