import { isResolverPlanNode } from "./plan-navigation";
import {
  instantiateHoodleFinancePlanSpecDag,
  type HoodleFinancePlanSpecDag,
} from "./plan-spec-dag";
import { normalizePlanSpecCode, type PlanSpec } from "./plan-specs";
import type { ResolverNode, ResolverPlanNode } from "./planner";
import {
  createPlanRuntimeRefs,
  type PlanRuntimeRefDependencies,
} from "./plan-runtime-refs";
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

export interface ResolveFlowDependencies
  extends ResolverMaterializationDependencies, PlanRuntimeRefDependencies {}

export interface ResolveFlowSpecs {
  planSpecsByCode: Record<string, PlanSpec>;
  resolverSpecsByCode: Record<string, string>;
}

export function collectResolveFlowResolverSpecs(
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

export function collectResolveFlowPlanSpecs(
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

export function deriveResolveFlowSpecs(
  planSpecsByCode: Record<string, PlanSpec>,
): ResolveFlowSpecs {
  const dag = instantiateHoodleFinancePlanSpecDag(planSpecsByCode);

  return {
    planSpecsByCode: collectResolveFlowPlanSpecs(dag),
    resolverSpecsByCode: collectResolveFlowResolverSpecs(dag),
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

export interface ResolveFlowOptions {
  dag: HoodleFinancePlanSpecDag;
  nodesByCode: Record<string, ResolverNode>;
  planNodesByCode: Record<string, ResolverPlanNode>;
  resolverNodesByCode: Record<string, ResolverNode>;
  runtimeRefs: ReturnType<typeof createPlanRuntimeRefs>;
}

export class ResolveFlow {
  readonly dag: HoodleFinancePlanSpecDag;
  readonly nodesByCode: Record<string, ResolverNode>;
  readonly planNodesByCode: Record<string, ResolverPlanNode>;
  readonly resolverNodesByCode: Record<string, ResolverNode>;
  private readonly runtimeRefs: ReturnType<typeof createPlanRuntimeRefs>;

  constructor(options: ResolveFlowOptions) {
    this.dag = options.dag;
    this.nodesByCode = options.nodesByCode;
    this.planNodesByCode = options.planNodesByCode;
    this.resolverNodesByCode = options.resolverNodesByCode;
    this.runtimeRefs = options.runtimeRefs;
  }

  readonly getNodeByCode = (code: string): ResolverNode => {
    const normalizedCode = normalizeCode(code);
    const existingNode = this.nodesByCode[normalizedCode];

    if (existingNode) {
      return existingNode;
    }

    const spec = requireDagNodeSpec(this.dag, normalizedCode);

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
      (nodeCode) => this.getNodeByCode(nodeCode),
      null,
      {
        refs: this.runtimeRefs,
      },
    );

    this.nodesByCode[normalizedCode] = compiledNode;
    if (isResolverPlanNode(compiledNode)) {
      this.planNodesByCode[normalizedCode] = compiledNode;
    }

    return compiledNode;
  };

  readonly getPlanNodeByCode = (code: string): ResolverPlanNode => {
    const node = this.getNodeByCode(code);

    if (!isResolverPlanNode(node)) {
      throw new Error(
        `Compiled DAG node "${normalizeCode(code)}" is not a resolver plan node.`,
      );
    }

    return node;
  };

  static fromPlanSpecs(
    planSpecsByCode: Record<string, PlanSpec>,
    deps: ResolveFlowDependencies,
  ): ResolveFlow {
    const dag = instantiateHoodleFinancePlanSpecDag(planSpecsByCode);
    const resolverRegistry = materializeResolversByCode(
      collectResolveFlowResolverSpecs(dag),
      deps,
    );
    const flow = new ResolveFlow({
      dag,
      nodesByCode: Object.assign(Object.create(null), resolverRegistry.byCode),
      planNodesByCode: Object.create(null),
      resolverNodesByCode: Object.assign(
        Object.create(null),
        resolverRegistry.byCode,
      ),
      runtimeRefs: createPlanRuntimeRefs(deps),
    });

    for (const node of dag.topologicalOrder) {
      if (isPlanResolverClass(node.spec.resolverClass)) {
        flow.getNodeByCode(node.code);
      }
    }

    return flow;
  }
}

export function compileResolveFlow(
  planSpecsByCode: Record<string, PlanSpec>,
  deps: ResolveFlowDependencies,
): ResolveFlow {
  return ResolveFlow.fromPlanSpecs(planSpecsByCode, deps);
}
