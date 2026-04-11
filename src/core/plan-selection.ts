import {
  resolveRoutingNode,
} from "./plan-navigation";
import type { RequestInput, ResolvedRequest } from "./request";
import type { ResolverNode, ResolverPlanNode } from "./planner";

export interface PlanSelectionDependencies {
  buildSelectedIdentifierPlan(
    resolverOrPlan: ResolverNode,
    request: RequestInput,
    parentPlan?: ResolverPlanNode | null,
  ): ResolverPlanNode;
  extractIsinFromRequestInput(input: RequestInput): string;
  listAllDefaultAttributePlans(): ResolverPlanNode[];
  getPlanNodeByCode(code: string): ResolverPlanNode;
}


export function buildAmbiguousDefaultAttributeRouteError(
  request: Pick<ResolvedRequest, "classification">,
  plans: Array<Pick<ResolverPlanNode, "name">>,
): Error {
  const classification = String(request.classification || "")
    .trim()
    .toLowerCase();
  const planNames = plans.map(
    (plan) =>
      String((plan && plan.name) || "").trim() ||
      "<unknown>",
  );

  return new Error(
    `Ambiguous default attribute route for classification "${classification}": ${planNames.join(", ")}.`,
  );
}

export function buildIdentifierResolutionPlan(
  input: RequestInput,
  deps: PlanSelectionDependencies,
): ResolverPlanNode | null {
  const isinValue = deps.extractIsinFromRequestInput(input);
  const identifierRoot = deps.getPlanNodeByCode("IDENTIFIER-ROOT");
  const identifierPlan = resolveRoutingNode(identifierRoot, input, {
    allowNone: true,
  }) as ResolverPlanNode | null;

  if (!isinValue) {
    return null;
  }

  return identifierPlan;
}

export function buildDefaultAttributePlanForResolvedRequest(
  request: ResolvedRequest,
  deps: Pick<PlanSelectionDependencies, "getPlanNodeByCode">,
): ResolverPlanNode {
  const defaultAttributeRoot =
    deps.getPlanNodeByCode("DEFAULT-ATTRIBUTE") as ResolverPlanNode;
  const candidatePlans = (defaultAttributeRoot.nodes || []).filter(
    (plan) => !plan.canHandle || plan.canHandle(request),
  ) as ResolverPlanNode[];

  if (!candidatePlans.length) {
    throw new Error("No attribute route is available for this request.");
  }

  if (candidatePlans.length > 1) {
    throw buildAmbiguousDefaultAttributeRouteError(request, candidatePlans);
  }

  return candidatePlans[0] as ResolverPlanNode;
}

export function buildQuoteRoutePlanForResolvedRequest(
  _input: RequestInput,
  request: ResolvedRequest,
  deps: Pick<
    PlanSelectionDependencies,
    "getPlanNodeByCode"
  >,
): ResolverPlanNode {
  return buildDefaultAttributePlanForResolvedRequest(request, deps);
}
