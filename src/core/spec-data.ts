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
  "ATTRIBUTE-IDENTITY": {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "ATTRIBUTE-IDENTITY",
  },
  ARIVA: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "ARIVA",
    options: {
      isSourceOverrideable: true,
      routingDescription: "ARIVA ISIN lookup",
    },
  },
  IBKR: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "IBKR",
    options: {
      isSourceOverrideable: true,
      routingDescription: "IBKR contract search ISIN lookup",
    },
  },
  LON: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "LON",
    options: {
      isSourceOverrideable: true,
      routingDescription: "LSE search ISIN lookup",
    },
  },
  PSE: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "PSE",
    options: {
      isSourceOverrideable: true,
      routingDescription: "PSE quote ISIN lookup",
    },
  },
  TRADINGVIEW: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "TRADINGVIEW",
    options: {
      isSourceOverrideable: true,
      routingDescription: "TradingView symbol page ISIN lookup",
    },
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
    nodeCodes: ["GOOGLE-FX", "YAHOO"],
    resolverClass: "AttributeResolutionPlan",
  },
  "QUOTE:PSE": {
    nodeCodes: ["PSE-FRAMES", "PSE-EDGE"],
    resolverClass: "AttributeResolutionPlan",
    options: {
      isSourceOverrideable: true,
      representativeTicker: "PSE:BDO",
      routingLabel: "PSE",
      routeClass: "EQUITY -> PSE",
      routeStateBuilderRef: "PSE_QUOTE",
      sourceName: "PSE",
    },
  },
  "QUOTE:TICKER": {
    nodeCodes: ["YAHOO", "TRADINGVIEW-FUND"],
    resolverClass: "AttributeResolutionPlan",
    options: {
      routingLabel: "TICKER",
      routeClassRef: "EQUITY_TICKER_CLASS",
      routePathRef: "EQUITY_TICKER_PATH",
      routeStateBuilderRef: "EQUITY_YAHOO_QUOTE",
    },
  },
  "DEFAULT-ATTRIBUTE:EQUITY": {
    nodeCodes: ["QUOTE:PSE", "QUOTE:TICKER"],
    resolverClass: "ResolverPlan",
    options: {
      canHandleRef: "CLASSIFICATION_EQUITY",
      isRoutingNode: true,
      routingLabel: "EQUITY",
    },
  },
  "DEFAULT-ATTRIBUTE:FX": {
    nodeCodes: ["FX-IDENTITY", "QUOTE:DEFAULT-FX"],
    resolverClass: "FxAttributeResolutionPlan",
    options: {
      canHandleRef: "CLASSIFICATION_FX",
      routingLabel: "FX",
    },
  },
  "DEFAULT-ATTRIBUTE": {
    nodeCodes: ["DEFAULT-ATTRIBUTE:EQUITY", "DEFAULT-ATTRIBUTE:FX"],
    resolverClass: "ResolverPlan",
    options: {
      isRoutingNode: true,
      routingLabel: "DEFAULT ATTRIBUTE",
    },
  },
  "IDENTIFIER-ROOT": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["RESOLVED-IDENTIFIER", "IDENTIFIER:ISIN"],
    options: {
      isRoutingNode: true,
      routingLabel: "IDENTIFIER",
    },
  },
  "ISIN-ATTRIBUTE-ROOT": {
    resolverClass: "ResolverPlan",
    nodeCodes: ["ISIN-SOURCE"],
    options: {
      isRoutingNode: true,
      routingLabel: "ISIN ATTRIBUTE",
    },
  },
  "ISIN-SOURCE": {
    resolverClass: "AttributeResolutionPlan",
    nodeCodes: ["ARIVA", "IBKR", "LON", "PSE", "TRADINGVIEW"],
  },
  ROOT: {
    resolverClass: "ResolverPlan",
    nodeCodes: ["DEFAULT-ATTRIBUTE", "IDENTIFIER-ROOT", "ISIN-ATTRIBUTE-ROOT"],
    options: {
      isRoutingNode: true,
      routingLabel: "ROOT",
    },
  },
};

export const PLAN_ROUTE_CLASS_REFS = {
  EQUITY_TICKER_CLASS: "EQUITY_TICKER_CLASS",
} as const;

export const PLAN_ROUTE_PATH_REFS = {
  EQUITY_TICKER_PATH: "EQUITY_TICKER_PATH",
} as const;



export const PLAN_ROUTE_STATE_BUILDER_REFS = {
  EQUITY_YAHOO_QUOTE: "EQUITY_YAHOO_QUOTE",
  FX_QUOTE: "FX_QUOTE",
  PSE_QUOTE: "PSE_QUOTE",
} as const;

export const PLAN_CAN_HANDLE_REFS = {
  CLASSIFICATION_EQUITY: "CLASSIFICATION_EQUITY",
  CLASSIFICATION_FX: "CLASSIFICATION_FX",
} as const;
