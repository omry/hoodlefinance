import {
  createConcreteResolverMaterializationDependencies,
} from "../core/concrete-resolvers";
import { ResolveFlow } from "../core/resolve-flow";
import { looksLikeIsin } from "../core/request";
import { DagPlan } from "../core/spec-data";
import { ResolverServices } from "./ResolverServices";
export type HoodlefinanceRuntime = Pick<
  ResolveFlow,
  "resolveAttribute"
>;

export function createHoodlefinanceRuntime(
  resolverServices: ResolverServices,
): HoodlefinanceRuntime {
  const resolverMaterializationDeps =
    createConcreteResolverMaterializationDependencies(resolverServices);

  const resolveFlow = new ResolveFlow(DagPlan, {
    ...resolverMaterializationDeps,
    looksLikeIsin,
  });

  return {
    resolveAttribute: resolveFlow.resolveAttribute.bind(resolveFlow),
  };
}
