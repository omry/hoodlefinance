import { CONCRETE_RESOLVER_CLASSES_BY_NAME } from "../core/concrete-resolvers";
import { ResolveFlow } from "../core/resolve-flow";
import { looksLikeIsin } from "../core/request";
import { DagPlan } from "../core/spec-data";
import { ResolverServices } from "./ResolverServices";

function createResolveFlow(
  resolverServices: ResolverServices,
): ResolveFlow {
  return new ResolveFlow(DagPlan, {
    looksLikeIsin,
    resolverClassesByName: CONCRETE_RESOLVER_CLASSES_BY_NAME,
    resolverServices,
  });
}

export function createHoodlefinanceRuntime(
  resolverServices: ResolverServices,
): Pick<
  ResolveFlow,
  "callSubgraph" | "getGraph" | "resolveAttribute" | "resolveAttributeWithTrace"
> {
  const resolveFlow = createResolveFlow(resolverServices);

  return {
    callSubgraph: resolveFlow.callSubgraph.bind(resolveFlow),
    getGraph: resolveFlow.getGraph.bind(resolveFlow),
    resolveAttribute: resolveFlow.resolveAttribute.bind(resolveFlow),
    resolveAttributeWithTrace: resolveFlow.resolveAttributeWithTrace.bind(resolveFlow),
  };
}
