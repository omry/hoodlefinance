import { isResolverPlanNode } from "./plan-navigation";
import { instantiateHoodleFinancePlanSpecDag, type HoodleFinancePlanSpecDag } from "./plan-spec-dag";
import { normalizePlanSpecCode, type PlanSpec } from "./plan-specs";
import type { ResolverNode, ResolverPlanNode } from "./planner";
import { createPlanRuntimeRefs, type PlanRuntimeRefDependencies } from "./plan-runtime-refs";
import {
  buildPlanNodeFromSpec,
  PLAN_RESOLVER_CLASSES_BY_NAME,
} from "./resolver-classes";
import {
  materializeResolversByCode,
  type ResolverMaterializationDependencies,
} from "./resolver-materialization";

function isPlanResolverClass(resolverClass: string): boolean {
  return !!(PLAN_RESOLVER_CLASSES_BY_NAME as Record<string, unknown>)[
    String(resolverClass || "")
  ];
}

function normalizeCode(code: string): string {
  return normalizePlanSpecCode(code);
}

export interface CompileDagPlanForLegacyExecutionDependencies
  extends ResolverMaterializationDependencies,
    PlanRuntimeRefDependencies {}

export interface LegacyExecutionSpecs {
  planSpecsByCode: Record<string, PlanSpec>;
  resolverSpecsByCode: Record<string, string>;
}

export interface CompiledDagPlanForLegacyExecution {
  dag: HoodleFinancePlanSpecDag;
  nodesByCode: Record<string, ResolverNode>;
  planNodesByCode: Record<string, ResolverPlanNode>;
  resolverNodesByCode: Record<string, ResolverNode>;
  getNodeByCode(code: string): ResolverNode;
  getPlanNodeByCode(code: string): ResolverPlanNode;
}

export function collectDagResolverSpecsForLegacyExecution(
  dag: HoodleFinancePlanSpecDag,
): Record<string, string> {
  const resolverSpecsByCode: Record<string, string> = Object.create(null);

  for (const node of dag.nodes) {
    if (
      isPlanResolverClass(node.spec.resolverClass) ||
      node.spec.resolverClass === "TerminalCollectorPlan"
    ) {
      continue;
    }

    resolverSpecsByCode[node.code] = node.spec.resolverClass;
  }

  return resolverSpecsByCode;
}

export function collectDagPlanSpecsForLegacyExecution(
  dag: HoodleFinancePlanSpecDag,
): Record<string, PlanSpec> {
  const planSpecsByCode: Record<string, PlanSpec> = Object.create(null);

  for (const node of dag.nodes) {
    if (!isPlanResolverClass(node.spec.resolverClass)) {
      continue;
    }

    planSpecsByCode[node.code] = node.spec;
  }

  return planSpecsByCode;
}

export function deriveDagPlanLegacyExecutionSpecs(
  planSpecsByCode: Record<string, PlanSpec>,
): LegacyExecutionSpecs {
  const dag = instantiateHoodleFinancePlanSpecDag(planSpecsByCode);

  return {
    planSpecsByCode: collectDagPlanSpecsForLegacyExecution(dag),
    resolverSpecsByCode: collectDagResolverSpecsForLegacyExecution(dag),
  };
}

function requireDagNodeSpec(
  dag: HoodleFinancePlanSpecDag,
  code: string,
): PlanSpec {
  const normalizedCode = normalizeCode(code);
  const dagNode = dag.nodesByCode[normalizedCode];

  if (!dagNode) {
    throw new Error(`Unknown compiled DAG node "${normalizedCode}".`);
  }

  return dagNode.spec;
}

export function compileDagPlanForLegacyExecution(
  planSpecsByCode: Record<string, PlanSpec>,
  deps: CompileDagPlanForLegacyExecutionDependencies,
): CompiledDagPlanForLegacyExecution {
  const dag = instantiateHoodleFinancePlanSpecDag(planSpecsByCode);
  const resolverRegistry = materializeResolversByCode(
    collectDagResolverSpecsForLegacyExecution(dag),
    deps,
  );
  const runtimeRefs = createPlanRuntimeRefs(deps);
  const nodesByCode: Record<string, ResolverNode> = Object.assign(
    Object.create(null),
    resolverRegistry.byCode,
  );
  const planNodesByCode: Record<string, ResolverPlanNode> = Object.create(null);
  const resolverNodesByCode: Record<string, ResolverNode> = Object.assign(
    Object.create(null),
    resolverRegistry.byCode,
  );

  function getNodeByCode(code: string): ResolverNode {
    const normalizedCode = normalizeCode(code);
    const existingNode = nodesByCode[normalizedCode];

    if (existingNode) {
      return existingNode;
    }

    const spec = requireDagNodeSpec(dag, normalizedCode);

    if (spec.resolverClass === "TerminalCollectorPlan") {
      throw new Error(
        `Compiled DAG terminal node "${normalizedCode}" is not executable.`,
      );
    }

    if (!isPlanResolverClass(spec.resolverClass)) {
      throw new Error(
        `Resolver node "${normalizedCode}" was not materialized during DAG compilation.`,
      );
    }

    const compiledNode = buildPlanNodeFromSpec(
      normalizedCode,
      spec,
      getNodeByCode,
      null,
      {
        refs: runtimeRefs,
        resolvePreferredYahooSymbol: deps.resolvePreferredYahooSymbol ?? null,
      },
    );

    nodesByCode[normalizedCode] = compiledNode;
    if (isResolverPlanNode(compiledNode)) {
      planNodesByCode[normalizedCode] = compiledNode;
    }

    return compiledNode;
  }

  for (const node of dag.topologicalOrder) {
    if (isPlanResolverClass(node.spec.resolverClass)) {
      getNodeByCode(node.code);
    }
  }

  return {
    dag,
    getNodeByCode,
    getPlanNodeByCode(code: string): ResolverPlanNode {
      const node = getNodeByCode(code);

      if (!isResolverPlanNode(node)) {
        throw new Error(
          `Compiled DAG node "${normalizeCode(code)}" is not a resolver plan node.`,
        );
      }

      return node;
    },
    nodesByCode,
    planNodesByCode,
    resolverNodesByCode,
  };
}
