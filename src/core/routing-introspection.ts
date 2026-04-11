import type { ResolverNode, ResolverPlanNode, RoutingNodeKind } from "./planner";
import { RawRequestInput, type RequestClassification, type RequestInput } from "./request";

export interface RoutingTableExample {
  example: string;
}

export interface RoutingTableRow {
  classification: RequestClassification;
  example: string;
  route: string;
}

export interface RoutingPlanTreeNode {
  children: RoutingPlanTreeNode[];
  kind: RoutingPlanNodeKind;
  label: string;
}

export type RoutingPlanNodeKind = RoutingNodeKind;

export const ROUTING_TABLE_EXAMPLES: RoutingTableExample[] = [
  { example: "GOOG" },
  { example: "TLV:KSMF59" },
  { example: "EURUSD" },
  { example: "USDUSD" },
  { example: "PSE:BDO" },
  { example: "US02079K1079" },
  { example: "PHY077751022" },
];

export interface RoutingIntrospectionDependencies {
  buildResolvePlan(requestInput: RawRequestInput): {
    debugValue: string;
    plannedRoute: string;
    requestInput: Pick<RequestInput, "classification">;
  };
}

interface RoutingPlanNodeLike {
  getRoutingNodes(): ResolverNode[];
  getRoutingNodeKind(): RoutingNodeKind;
  name: string;
}

interface DescribableRoutingNode {
  describeRoutingNode(): string;
}

function isRoutingPlanNode(node: unknown): node is RoutingPlanNodeLike {
  return (
    !!node &&
    typeof (node as RoutingPlanNodeLike).getRoutingNodes === "function"
  );
}

function isDescribableRoutingNode(
  node: unknown,
): node is DescribableRoutingNode {
  return (
    !!node &&
    typeof (node as DescribableRoutingNode).describeRoutingNode === "function"
  );
}

export function formatRoutingPlanTreeLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function buildRoutingTableRow(
  row: RoutingTableExample,
  deps: RoutingIntrospectionDependencies,
): RoutingTableRow {
  const resolvePlan = deps.buildResolvePlan(
    new RawRequestInput(row.example, "price"),
  );

  return {
    classification: resolvePlan.requestInput.classification,
    example: row.example,
    route: resolvePlan.debugValue || resolvePlan.plannedRoute,
  };
}

export function getRoutingTableRows(
  deps: RoutingIntrospectionDependencies,
): RoutingTableRow[] {
  return ROUTING_TABLE_EXAMPLES.map((row) => buildRoutingTableRow(row, deps));
}

export function buildRoutingTableGrid(
  deps: RoutingIntrospectionDependencies,
): string[][] {
  const rows = getRoutingTableRows(deps);
  const grid = [["classification", "example", "planned route"]];

  for (const row of rows) {
    grid.push([row.classification, row.example, row.route]);
  }

  return grid;
}

export function buildRoutingPlanTreeNode(
  node: ResolverNode | RoutingPlanNodeLike | null,
): RoutingPlanTreeNode {
  if (!node) {
    return {
      children: [],
      kind: "leaf",
      label: "NULL",
    };
  }

  const isPlanNode = isRoutingPlanNode(node);

  return {
    children: isPlanNode
      ? node
          .getRoutingNodes()
          .map((childNode) => buildRoutingPlanTreeNode(childNode))
      : [],
    kind: node.getRoutingNodeKind ? node.getRoutingNodeKind() : "leaf",
    label: isPlanNode
      ? formatRoutingPlanTreeLabel(node.name || "")
      : String(
          isDescribableRoutingNode(node)
            ? node.describeRoutingNode()
            : formatRoutingPlanTreeLabel(node && node.name),
        ),
  };
}
