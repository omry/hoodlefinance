import { createConcreteResolverRegistry } from "../core/hf-resolvers";
import {
  Flow,
  resolveAttribute,
  resolveAttributeWithTrace,
} from "../core/resolve-flow";
import { DagPlan } from "../core/spec-data";
import { ResolverServices } from "./ResolverServices";

function createFlow(resolverServices: ResolverServices): Flow {
  const resolverRegistry = createConcreteResolverRegistry();
  return new Flow(DagPlan, resolverRegistry, resolverServices);
}

export function createHoodlefinanceRuntime(
  resolverServices: ResolverServices,
): Pick<Flow, "callSubgraph" | "getGraph"> & {
  resolveAttribute(identifier: string, attribute?: string): unknown;
  resolveAttributeWithTrace(
    identifier: string,
    attribute?: string,
  ): ReturnType<typeof resolveAttributeWithTrace>;
} {
  const resolveFlow = createFlow(resolverServices);

  return {
    callSubgraph: resolveFlow.callSubgraph.bind(resolveFlow),
    getGraph: resolveFlow.getGraph.bind(resolveFlow),
    resolveAttribute: (identifier, attribute) =>
      resolveAttribute(resolveFlow, identifier, attribute),
    resolveAttributeWithTrace: (identifier, attribute) =>
      resolveAttributeWithTrace(resolveFlow, identifier, attribute),
  };
}
