import type { PlanSpec, ResolverSpec } from "./plan-specs";

function definePlanSpec<T extends PlanSpec>(spec: T): T {
  return spec;
}

export const RESOLVER_SPECS_BY_CODE: Record<string, ResolverSpec> = {
  "RESOLVED-IDENTIFIER": {
    resolverClass: "DirectIdentifierResolver",
  },
  "PSE-MAP": {
    resolverClass: "PseIsinMapResolver",
  },
  "YAHOO-ISIN": {
    resolverClass: "YahooIsinSearchResolver",
  },
  "FX-IDENTITY": {
    resolverClass: "LocalFxResolver",
  },
  "GOOGLE-FX": {
    resolverClass: "GoogleFxResolver",
  },
  YAHOO: {
    resolverClass: "YahooQuoteResolver",
  },
  "TRADINGVIEW-FUND": {
    resolverClass: "TradingviewFundResolver",
  },
  "PSE-FRAMES": {
    resolverClass: "PSEFramesResolver",
  },
  "PSE-EDGE": {
    resolverClass: "PSEEdgeResolver",
  },
};

export const PLAN_SPECS_BY_CODE: Record<string, PlanSpec> = {
  "IDENTIFIER:ISIN": definePlanSpec({
    resolverClass: "IdentifierResolutionPlan",
    nodeCodeByIsinCountry: {
      PH: "PSE-MAP",
      _default_: "YAHOO-ISIN",
    },
  }),
  "QUOTE:DEFAULT-FX": {
    resolverClass: "AttributeResolutionPlan",
    nodeCodes: ["GOOGLE-FX", "YAHOO"],
  },
  "QUOTE:PSE": {
    resolverClass: "PseQuoteResolutionPlan",
    nodeCodes: ["PSE-FRAMES", "PSE-EDGE"],
    options: {
routeStateBuilderRef: "PSE_QUOTE",
    },
  },
  "QUOTE:TICKER": {
    resolverClass: "TickerQuoteResolutionPlan",
    nodeCodes: ["YAHOO", "TRADINGVIEW-FUND"],
    options: {
      routeStateBuilderRef: "EQUITY_YAHOO_QUOTE",
    },
  },
  "DEFAULT-ATTRIBUTE:EQUITY": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["QUOTE:PSE", "QUOTE:TICKER"],
    options: {
      canHandleRef: "CLASSIFICATION_EQUITY",
      isRoutingNode: true,
    },
  },
  "DEFAULT-ATTRIBUTE:FX": {
    resolverClass: "FxAttributeResolutionPlan",
    nodeCodes: ["FX-IDENTITY", "QUOTE:DEFAULT-FX"],
    options: {
      canHandleRef: "CLASSIFICATION_FX",
    },
  },
  "DEFAULT-ATTRIBUTE": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["DEFAULT-ATTRIBUTE:EQUITY", "DEFAULT-ATTRIBUTE:FX"],
    options: {
      isRoutingNode: true,
    },
  },
  "IDENTIFIER-ROOT": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["RESOLVED-IDENTIFIER", "IDENTIFIER:ISIN"],
    options: {
      isRoutingNode: true,
    },
  },
  "ROOT": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["DEFAULT-ATTRIBUTE", "IDENTIFIER-ROOT"],
    options: {
      isRoutingNode: true,
    },
  },
};

export const PLAN_ROUTE_STATE_BUILDER_REFS = {
  EQUITY_YAHOO_QUOTE: "EQUITY_YAHOO_QUOTE",
  FX_QUOTE: "FX_QUOTE",
  PSE_QUOTE: "PSE_QUOTE",
} as const;

export const PLAN_CAN_HANDLE_REFS = {
  CLASSIFICATION_EQUITY: "CLASSIFICATION_EQUITY",
  CLASSIFICATION_FX: "CLASSIFICATION_FX",
} as const;
