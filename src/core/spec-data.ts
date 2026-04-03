import type { PlanSpec, ResolverSpec } from "./plan-specs";

function definePlanSpec<T extends PlanSpec>(spec: T): T {
  return spec;
}

export const RESOLVER_SPECS_BY_CODE: Record<string, ResolverSpec> = {
  "DIRECT-IDENTIFIER": {
    resolverClass: "DirectIdentifierResolver",
  },
  "PSE-MAP": {
    resolverClass: "PseIsinMapResolver",
  },
  "YAHOO-ISIN": {
    resolverClass: "YahooIsinSearchResolver",
  },
  LOCAL: {
    resolverClass: "LocalFxResolver",
  },
  GOOGLE: {
    resolverClass: "GoogleFxResolver",
  },
  YAHOO: {
    resolverClass: "YahooQuoteResolver",
  },
  "TRADINGVIEW-FUND": {
    resolverClass: "TradingviewFundResolver",
  },
  DIRECT: {
    resolverClass: "FunctionValueResolver",
    resolveFunctionRef: "DIRECT",
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
    },
    defaultNodeCodes: ["YAHOO-ISIN"],
    options: {
      routeStateBuilderRef: "ISIN_IDENTIFIER",
    },
  }),
  "QUOTE:FX-SAME": {
    nodeCodes: ["LOCAL"],
    resolverClass: "AttributeResolutionPlan",
    options: {
      routingLabel: "FX-SAME",
      routeClass: "FX",
      routePath: "LOCAL",
    },
  },
  "QUOTE:FX": {
    nodeCodes: ["GOOGLE", "YAHOO"],
    resolverClass: "AttributeResolutionPlan",
    options: {
      nodeSelectorRef: "DEFAULT_FX_QUOTE",
      routingLabel: "FX",
      routeClass: "FX",
      routePath: "GOOGLE",
      routeStateBuilderRef: "FX_QUOTE",
    },
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
    nodeCodes: ["QUOTE:FX-SAME", "QUOTE:FX"],
    resolverClass: "ResolverPlan",
    options: {
      canHandleRef: "CLASSIFICATION_FX",
      isRoutingNode: true,
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
    nodeCodes: ["IDENTIFIER:ISIN"],
    resolverClass: "ResolverPlan",
    options: {
      isRoutingNode: true,
      routingLabel: "IDENTIFIER",
    },
  },
  "ISIN-ATTRIBUTE-ROOT": {
    nodeCodes: ["ISIN-SOURCE"],
    resolverClass: "ResolverPlan",
    options: {
      isRoutingNode: true,
      routingLabel: "ISIN ATTRIBUTE",
    },
  },
  "ISIN-SOURCE": {
    nodeCodes: ["ARIVA", "IBKR", "LON", "PSE", "TRADINGVIEW"],
    resolverClass: "AttributeResolutionPlan",
  },
  ROOT: {
    nodeCodes: ["DEFAULT-ATTRIBUTE", "IDENTIFIER-ROOT", "ISIN-ATTRIBUTE-ROOT"],
    resolverClass: "ResolverPlan",
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

export const PLAN_NODE_SELECTOR_REFS = {
  DEFAULT_FX_QUOTE: "DEFAULT_FX_QUOTE",
} as const;

export const PLAN_ROUTE_STATE_BUILDER_REFS = {
  EQUITY_YAHOO_QUOTE: "EQUITY_YAHOO_QUOTE",
  FX_QUOTE: "FX_QUOTE",
  ISIN_IDENTIFIER: "ISIN_IDENTIFIER",
  PSE_QUOTE: "PSE_QUOTE",
} as const;

export const PLAN_CAN_HANDLE_REFS = {
  CLASSIFICATION_EQUITY: "CLASSIFICATION_EQUITY",
  CLASSIFICATION_FX: "CLASSIFICATION_FX",
} as const;
