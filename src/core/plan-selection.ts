import {
  findNamedResolverNode,
  resolveRoutingNode,
} from "./plan-navigation";
import type { RequestInput, ResolvedRequest } from "./request";
import type { ResolverNode, ResolverPlanNode } from "./planner";

export interface PlanSelectionDependencies {
  buildSelectedIdentifierPlan(
    resolverOrPlan: ResolverNode,
    request: RequestInput,
  ): ResolverPlanNode;
  buildForcedSelectedAttributePlan(
    resolverOrPlan: ResolverNode,
    request: ResolvedRequest,
  ): ResolverPlanNode;
  extractIsinFromRequestInput(input: RequestInput): string;
  listAllDefaultAttributePlans(): ResolverPlanNode[];
  getPlanNodeByCode(code: string): ResolverPlanNode;
}

function normalizeSourceOverride(
  input: Pick<RequestInput, "sourceOverride">,
): string {
  return String(input.sourceOverride || "")
    .trim()
    .toUpperCase();
}

export function buildSourceOverrideUnavailableError(
  sourceOverride: string,
  contextLabel?: string,
): Error {
  const suffix = contextLabel ? ` for ${contextLabel}` : " for this request";

  return new Error(`"@${sourceOverride}" is not available${suffix}.`);
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
  const sourceOverride = normalizeSourceOverride(input);
  const identifierRoot = deps.getPlanNodeByCode("IDENTIFIER-ROOT");
  const identifierPlan = resolveRoutingNode(identifierRoot, input, {
    allowNone: true,
  }) as ResolverPlanNode | null;
  const selectedNode =
    sourceOverride && identifierPlan
      ? findNamedResolverNode(identifierPlan, sourceOverride, input)
      : null;

  if (!isinValue) {
    return null;
  }

  if (selectedNode) {
    return deps.buildSelectedIdentifierPlan(selectedNode, input);
  }

  if (sourceOverride) {
    throw buildSourceOverrideUnavailableError(sourceOverride);
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

export function buildForcedAttributePlanForResolvedRequest(
  input: RequestInput,
  request: ResolvedRequest,
  deps: Pick<
    PlanSelectionDependencies,
    "buildForcedSelectedAttributePlan" | "getPlanNodeByCode"
  >,
): ResolverPlanNode {
  const sourceOverride = normalizeSourceOverride(input);
  const defaultPlan = buildDefaultAttributePlanForResolvedRequest(
    request,
    deps,
  );

  if (input.attributeType !== "quote") {
    throw buildSourceOverrideUnavailableError(sourceOverride);
  }

  const selectedNode = findNamedResolverNode(
    defaultPlan,
    sourceOverride,
    request,
  );

  if (selectedNode) {
    return deps.buildForcedSelectedAttributePlan(selectedNode, request);
  }

  throw buildSourceOverrideUnavailableError(sourceOverride);
}

export function buildQuoteRoutePlanForResolvedRequest(
  input: RequestInput,
  request: ResolvedRequest,
  deps: Pick<
    PlanSelectionDependencies,
    "buildForcedSelectedAttributePlan" | "getPlanNodeByCode"
  >,
): ResolverPlanNode {
  const sourceOverride = normalizeSourceOverride(input);

  if (sourceOverride && input.attributeType === "quote") {
    return buildForcedAttributePlanForResolvedRequest(input, request, deps);
  }

  return buildDefaultAttributePlanForResolvedRequest(request, deps);
}
