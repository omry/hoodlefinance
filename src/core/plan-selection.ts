import {
  resolveRoutingNode,
} from "./plan-navigation";
import type { RequestInput, ResolvedRequest } from "./request";
import type { Resolver, ResolverPlan } from "./resolver-classes";

export interface PlanSelectionDependencies {
  buildSelectedIdentifierPlan(
    resolverOrPlan: Resolver,
    request: RequestInput,
    parentPlan?: ResolverPlan | null,
  ): ResolverPlan;
  extractIsinFromRequestInput(input: RequestInput): string;
  listAllDefaultAttributePlans(): ResolverPlan[];
  getPlanNodeByCode(code: string): ResolverPlan;
}


export function buildAmbiguousDefaultAttributeRouteError(
  request: Pick<ResolvedRequest, "classification">,
  plans: Array<Pick<ResolverPlan, "name">>,
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
): ResolverPlan | null {
  const isinValue = deps.extractIsinFromRequestInput(input);
  const identifierRoot = deps.getPlanNodeByCode("IDENTIFIER-ROOT");
  const identifierPlan = resolveRoutingNode(identifierRoot, input, {
    allowNone: true,
  }) as ResolverPlan | null;

  if (!isinValue) {
    return null;
  }

  return identifierPlan;
}

export function buildDefaultAttributePlanForResolvedRequest(
  request: ResolvedRequest,
  deps: Pick<PlanSelectionDependencies, "getPlanNodeByCode">,
): ResolverPlan {
  const defaultAttributeRoot =
    deps.getPlanNodeByCode("DEFAULT-ATTRIBUTE") as ResolverPlan;
  const candidatePlans = (defaultAttributeRoot.nodes || []).filter(
    (plan) => !plan.canHandle || plan.canHandle(request),
  ) as ResolverPlan[];

  if (!candidatePlans.length) {
    throw new Error("No attribute route is available for this request.");
  }

  if (candidatePlans.length > 1) {
    throw buildAmbiguousDefaultAttributeRouteError(request, candidatePlans);
  }

  return candidatePlans[0] as ResolverPlan;
}

export function buildQuoteRoutePlanForResolvedRequest(
  _input: RequestInput,
  request: ResolvedRequest,
  deps: Pick<
    PlanSelectionDependencies,
    "getPlanNodeByCode"
  >,
): ResolverPlan {
  return buildDefaultAttributePlanForResolvedRequest(request, deps);
}
