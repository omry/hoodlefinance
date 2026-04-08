import type { PlanSpec } from "./plan-specs";

function definePlanSpec<T extends PlanSpec>(spec: T): T {
  return spec;
}

export const DagPlan: Record<string, PlanSpec> = {
  ROOT: {
    resolverClass: "RequestClassificationPlan",
    nodeCodes: ["CLASSIFY-REQUEST", "REQUEST-ROOT"],
  },
  "REQUEST-ROOT": {
    resolverClass: "RoutingPlan",
    nodeCodes: ["DEFAULT-ATTRIBUTE", "IDENTIFIER-ROOT"],
  },
  "CLASSIFY-REQUEST": {
    resolverClass: "RequestClassifierResolver",
    nodeCodes: ["TERMINAL"],
  },
  "DEFAULT-ATTRIBUTE": {
    resolverClass: "RoutingPlan",
    nodeCodes: ["DEFAULT-ATTRIBUTE:EQUITY", "DEFAULT-ATTRIBUTE:FX"],
  },
  "DEFAULT-ATTRIBUTE:EQUITY": {
    resolverClass: "EquityAttributeResolutionPlan",
    nodeCodes: ["QUOTE:PSE", "QUOTE:TICKER"],
  },
  "DEFAULT-ATTRIBUTE:FX": {
    resolverClass: "FxAttributeResolutionPlan",
    nodeCodes: ["FX-IDENTITY", "QUOTE:DEFAULT-FX"],
  },
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
  "IDENTIFIER-ROOT": {
    resolverClass: "RoutingPlan",
    nodeCodes: ["RESOLVED-IDENTIFIER", "IDENTIFIER:ISIN"],
  },
  "IDENTIFIER:ISIN": definePlanSpec({
    resolverClass: "FirstSuccessPlan",
    nodeCodes: ["ISIN:PSE", "ISIN:YAHOO"],
  }),
  "RESOLVED-IDENTIFIER": {
    resolverClass: "DirectIdentifierResolver",
    nodeCodes: ["TERMINAL"],
  },
  "ISIN:PSE": {
    resolverClass: "PseIsinMapResolver",
    nodeCodes: ["TERMINAL"],
  },
  "ISIN:YAHOO": {
    resolverClass: "YahooIsinSearchResolver",
    nodeCodes: ["TERMINAL"],
  },
  "FX-IDENTITY": {
    resolverClass: "LocalFxResolver",
    nodeCodes: ["TERMINAL"],
  },
  "GOOGLE-FX": {
    resolverClass: "GoogleFxResolver",
    nodeCodes: ["TERMINAL"],
  },
  YAHOO: {
    resolverClass: "YahooQuoteResolver",
    nodeCodes: ["TERMINAL"],
  },
  "TRADINGVIEW-FUND": {
    resolverClass: "TradingviewFundResolver",
    nodeCodes: ["TERMINAL"],
  },
  "PSE-FRAMES": {
    resolverClass: "PSEFramesResolver",
    nodeCodes: ["TERMINAL"],
  },
  "PSE-EDGE": {
    resolverClass: "PSEEdgeResolver",
    nodeCodes: ["TERMINAL"],
  },
  TERMINAL: {
    resolverClass: "TerminalCollectorPlan",
  },
};
