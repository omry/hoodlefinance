import type { RouteStateBuilder } from "./planner";
import { buildEquityYahooQuoteRouteState, buildFxQuoteRouteState, buildPseQuoteRouteState } from "./route-state";
import type { ResolvedRequest } from "./request";

export interface PlanRuntimeRefDependencies {
  looksLikeIsin(value: string): boolean;
  resolvePreferredYahooSymbol?(symbol: string): string;
}

export function createPlanRouteStateBuilders(
  deps: PlanRuntimeRefDependencies,
): Record<string, RouteStateBuilder> {
  return {
    EQUITY_YAHOO_QUOTE(request) {
      return buildEquityYahooQuoteRouteState(
        request as Extract<ResolvedRequest, { requestType: "equity" }>,
        deps.resolvePreferredYahooSymbol,
      );
    },
    FX_QUOTE(request) {
      return buildFxQuoteRouteState(
        request as Extract<ResolvedRequest, { requestType: "fx" }>,
      );
    },
    PSE_QUOTE(request) {
      return buildPseQuoteRouteState(
        request as Extract<ResolvedRequest, { requestType: "equity" }>,
      );
    },
  };
}

export function createPlanRuntimeRefs(
  deps: PlanRuntimeRefDependencies,
): PlanRuntimeRefs {
  return {
    looksLikeIsin: deps.looksLikeIsin,
    routeStateBuilderByRef: createPlanRouteStateBuilders(deps),
  };
}

export interface PlanRuntimeRefs {
  looksLikeIsin(value: string): boolean;
  routeStateBuilderByRef: Record<string, RouteStateBuilder>;
}
