import { createConcreteResolverMaterializationDependencies } from "../core/concrete-resolvers";
import { ResolveFlow } from "../core/resolve-flow";
import { looksLikeIsin } from "../core/request";
import { DagPlan } from "../core/spec-data";
import { ResolverServices } from "./ResolverServices";

function createResolveFlow(
  resolverServices: ResolverServices,
): ResolveFlow {
  const resolverMaterializationDeps =
    createConcreteResolverMaterializationDependencies(resolverServices);

  return new ResolveFlow(DagPlan, {
    ...resolverMaterializationDeps,
    looksLikeIsin,
  });
}

export function createHoodlefinanceRuntime(
  resolverServices: ResolverServices,
): Pick<ResolveFlow, "getGraph" | "resolveAttribute"> {
  const resolveFlow = createResolveFlow(resolverServices);

  return {
    getGraph: resolveFlow.getGraph.bind(resolveFlow),
    resolveAttribute: resolveFlow.resolveAttribute.bind(resolveFlow),
  };
}
