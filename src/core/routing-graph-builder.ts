/* SPDX-License-Identifier: MPL-2.0 */

import type { RoutingGraph } from "./routing-graph";
import type { RequestInput } from "./request";
import type { FxPair } from "./request";
import type { LookupEnvelopeResult } from "./request-resolution";
import type { ResolvePlan } from "./planner";
import type { ResolveIsinAttributeDependencies } from "./routing-nodes";

export interface RoutingGraphBuilderDependencies {
  /** Computes the full resolve plan for a given request — the "map". */
  buildResolvePlan: (input: RequestInput) => ResolvePlan;
  /** Resolves an FX rate for currency conversion nodes. */
  resolveFxRate: (fxPair: FxPair) => LookupEnvelopeResult;
  /** Required for ISIN attribute type requests. */
  isinDeps?: ResolveIsinAttributeDependencies;
}

/**
 * Build a routing graph for a single request.
 *
 * The graph builder is a compiler over `buildResolvePlan` — it reads the plan
 * (which already encodes all routing decisions) and translates it into a
 * `RoutingGraph` for execution via `executeGraph`.
 *
 * TODO: implement plan-driven graph builder using PlanIdentifierNode + PlanQuoteNode.
 */
export function buildRoutingGraph(
  _input: RequestInput,
  _deps: RoutingGraphBuilderDependencies,
): RoutingGraph {
  throw new Error("buildRoutingGraph: plan-driven implementation not yet done");
}
