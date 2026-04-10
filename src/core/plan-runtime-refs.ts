import type { ResolverPlanNode } from "./planner";

export interface PlanRuntimeRefs {
  // TEMPORARY: attribute-side resolution uses the runtime FX root plan
  // directly for output-currency conversion until the execution DAG can model
  // that edge explicitly.
  getFxPlan(): ResolverPlanNode;
}
