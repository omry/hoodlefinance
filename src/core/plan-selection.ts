import { findNamedResolverNode, resolveRoutingNode } from "./plan-navigation";
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
  materializePlanFromSpec(code: string): ResolverPlanNode;
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
  plans: Array<Pick<ResolverPlanNode, "name" | "routingLabel">>,
): Error {
  const classification = String(request.classification || "")
    .trim()
    .toLowerCase();
  const planNames = plans.map(
    (plan) =>
      String((plan && (plan.routingLabel || plan.name)) || "").trim() ||
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
  const identifierRoot = deps.materializePlanFromSpec("IDENTIFIER-ROOT");
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
  deps: Pick<PlanSelectionDependencies, "materializePlanFromSpec">,
): ResolverPlanNode {
  const defaultAttributeRoot =
    deps.materializePlanFromSpec("DEFAULT-ATTRIBUTE");

  return resolveRoutingNode(defaultAttributeRoot, request, {
    onMultiple: (_routingNode, plans) =>
      buildAmbiguousDefaultAttributeRouteError(
        request,
        plans as Array<Pick<ResolverPlanNode, "name" | "routingLabel">>,
      ),
    onNone: () =>
      new Error("No attribute route is available for this request."),
  }) as ResolverPlanNode;
}

export function buildForcedAttributePlanForResolvedRequest(
  input: RequestInput,
  request: ResolvedRequest,
  deps: Pick<
    PlanSelectionDependencies,
    "buildForcedSelectedAttributePlan" | "materializePlanFromSpec"
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
    "buildForcedSelectedAttributePlan" | "materializePlanFromSpec"
  >,
): ResolverPlanNode {
  const sourceOverride = normalizeSourceOverride(input);

  if (sourceOverride && input.attributeType === "quote") {
    return buildForcedAttributePlanForResolvedRequest(input, request, deps);
  }

  return buildDefaultAttributePlanForResolvedRequest(request, deps);
}
