import {
  getGraphNodeNextIds,
  normalizeGraphNodeId,
  type Graph,
} from "./graph";

export type PlanSpec = Graph.Node;

export const normalizePlanSpecCode = normalizeGraphNodeId;

export const getPlanSpecNodeCodes = getGraphNodeNextIds;
