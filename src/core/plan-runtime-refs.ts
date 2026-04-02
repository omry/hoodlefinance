import type {
  NodeSelector,
  ResolverNode,
  RouteClassResolver,
  RoutePathResolver,
  RouteStateBuilder,
} from "./planner";
import { buildIsinIdentifierRouteState, buildEquityYahooQuoteRouteState, buildFxQuoteRouteState, buildPseQuoteRouteState } from "./route-state";
import type { RequestInput, ResolvedRequest } from "./request";
import { extractIsinFromRequestInput } from "./request-building";

export const PLAN_ROUTE_CLASS_BY_REF: Record<string, RouteClassResolver> = {
  EQUITY_TICKER_CLASS() {
    return "EQUITY -> TICKER";
  },
};

export const PLAN_ROUTE_PATH_BY_REF: Record<string, RoutePathResolver> = {
  EQUITY_TICKER_PATH(equityRequest) {
    return "allowTradingviewFallback" in equityRequest &&
      equityRequest.allowTradingviewFallback
      ? "YAHOO -> TRADINGVIEW"
      : "YAHOO";
  },
};

export const PLAN_NODE_SELECTOR_BY_REF: Record<string, NodeSelector> = {
  DEFAULT_FX_QUOTE(nodes) {
    return nodes.filter(
      (node) =>
        String((node && node.name) || "")
          .trim()
          .toUpperCase() === "GOOGLE",
    );
  },
};

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
    ISIN_IDENTIFIER(request) {
      return buildIsinIdentifierRouteState(
        request as RequestInput,
        (input) => extractIsinFromRequestInput(input, deps.looksLikeIsin),
      );
    },
    PSE_QUOTE(request) {
      return buildPseQuoteRouteState(
        request as Extract<ResolvedRequest, { requestType: "equity" }>,
      );
    },
  };
}

export const PLAN_CAN_HANDLE_BY_REF: Record<
  string,
  (request: RequestInput | ResolvedRequest) => boolean
> = {
  CLASSIFICATION_EQUITY(request) {
    return (
      String((request && request.classification) || "")
        .trim()
        .toLowerCase() === "equity"
    );
  },
  CLASSIFICATION_FX(request) {
    return (
      String((request && request.classification) || "")
        .trim()
        .toLowerCase() === "fx"
    );
  },
};

export function createPlanRuntimeRefs(
  deps: PlanRuntimeRefDependencies,
): PlanRuntimeRefs {
  return {
    canHandleByRef: PLAN_CAN_HANDLE_BY_REF,
    nodeSelectorByRef: PLAN_NODE_SELECTOR_BY_REF,
    routeClassByRef: PLAN_ROUTE_CLASS_BY_REF,
    routePathByRef: PLAN_ROUTE_PATH_BY_REF,
    routeStateBuilderByRef: createPlanRouteStateBuilders(deps),
  };
}

export interface PlanRuntimeRefs {
  canHandleByRef: Record<
    string,
    (request: RequestInput | ResolvedRequest) => boolean
  >;
  nodeSelectorByRef: Record<string, NodeSelector>;
  routeClassByRef: Record<string, RouteClassResolver>;
  routePathByRef: Record<string, RoutePathResolver>;
  routeStateBuilderByRef: Record<string, RouteStateBuilder>;
}
