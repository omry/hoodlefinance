import type { ResolveFlow } from "./resolve-flow";

export interface PlanRuntimeRefs {
  // TEMPORARY: attribute-side resolution will use this to reach the main FX
  // node/subtree directly for output-currency conversion until the compiled
  // execution DAG can model that edge explicitly.
  resolveFlow: ResolveFlow;
}
