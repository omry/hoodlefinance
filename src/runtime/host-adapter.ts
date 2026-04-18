import { CONCRETE_RESOLVER_CLASSES_BY_NAME } from "../core/concrete-resolvers";
import {
  ResolveFlow,
  resolveAttribute,
  resolveAttributeWithTrace,
} from "../core/resolve-flow";
import { DagPlan } from "../core/spec-data";
import { ResolverServices } from "./ResolverServices";

function createResolveFlow(
  resolverServices: ResolverServices,
): ResolveFlow {
  return new ResolveFlow(DagPlan, {
    resolverClassesByName: CONCRETE_RESOLVER_CLASSES_BY_NAME,
    resolverEnv: resolverServices,
  });
}

export function createHoodlefinanceRuntime(
  resolverServices: ResolverServices,
): Pick<ResolveFlow, "callSubgraph" | "getGraph"> & {
  resolveAttribute(identifier: string, attribute?: string): unknown;
  resolveAttributeWithTrace(
    identifier: string,
    attribute?: string,
  ): ReturnType<typeof resolveAttributeWithTrace>;
} {
  const resolveFlow = createResolveFlow(resolverServices);

  return {
    callSubgraph: resolveFlow.callSubgraph.bind(resolveFlow),
    getGraph: resolveFlow.getGraph.bind(resolveFlow),
    resolveAttribute: (identifier, attribute) =>
      resolveAttribute(resolveFlow, identifier, attribute),
    resolveAttributeWithTrace: (identifier, attribute) =>
      resolveAttributeWithTrace(resolveFlow, identifier, attribute),
  };
}
