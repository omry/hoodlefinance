import type { PlanSpec } from "./plan-specs";

function definePlanSpec<T extends PlanSpec>(spec: T): T {
  return spec;
}

export const RESOLVER_SPECS_BY_CODE: Record<string, string> = {
  "RESOLVED-IDENTIFIER": "DirectIdentifierResolver",
  "PSE-MAP": "PseIsinMapResolver",
  "YAHOO-ISIN": "YahooIsinSearchResolver",
  "FX-IDENTITY": "LocalFxResolver",
  "GOOGLE-FX": "GoogleFxResolver",
  YAHOO: "YahooQuoteResolver",
  "TRADINGVIEW-FUND": "TradingviewFundResolver",
  "PSE-FRAMES": "PSEFramesResolver",
  "PSE-EDGE": "PSEEdgeResolver",
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
  },
  "QUOTE:TICKER": {
    resolverClass: "TickerQuoteResolutionPlan",
    nodeCodes: ["YAHOO", "TRADINGVIEW-FUND"],
  },
  "DEFAULT-ATTRIBUTE:EQUITY": {
    resolverClass: "EquityAttributeResolutionPlan",
    nodeCodes: ["QUOTE:PSE", "QUOTE:TICKER"],
    options: {
      isRoutingNode: true,
    },
  },
  "DEFAULT-ATTRIBUTE:FX": {
    resolverClass: "FxAttributeResolutionPlan",
    nodeCodes: ["FX-IDENTITY", "QUOTE:DEFAULT-FX"],
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

