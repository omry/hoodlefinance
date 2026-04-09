import {
  createConcreteResolverMaterializationDependencies,
  type ConcreteResolverMaterializationDependencies,
} from "../core/concrete-resolvers";
import { ResolveFlow } from "../core/resolve-flow";
import { looksLikeIsin } from "../core/request";
import { DagPlan } from "../core/spec-data";
export type HoodlefinanceRuntime = Pick<
  ResolveFlow,
  "lookup" | "lookupEnvelope" | "resolveAttribute"
>;

export function createHoodlefinanceRuntime(
  deps: ConcreteResolverMaterializationDependencies,
): HoodlefinanceRuntime {
  const resolverMaterializationDeps =
    createConcreteResolverMaterializationDependencies(deps);

  const resolveFlow = new ResolveFlow(DagPlan, {
    ...resolverMaterializationDeps,
    looksLikeIsin,
  });

  return {
    lookup: resolveFlow.lookup,
    lookupEnvelope: resolveFlow.lookupEnvelope,
    resolveAttribute: resolveFlow.resolveAttribute.bind(resolveFlow),
  };
}
