import type { Graph } from "./graph";

function defineGraphNode<T extends Graph.Node>(node: T): T {
  return node;
}

export const DagPlan: Graph.Definition = {
  ROOT: {
    id: "ROOT",
    next: ["CLASSIFY-REQUEST"],
    type: "StepPlan",
  },
  "REQUEST-ROOT": {
    id: "REQUEST-ROOT",
    next: ["DEFAULT-ATTRIBUTE", "IDENTIFIER-ROOT"],
    type: "RoutingPlan",
  },
  "CLASSIFY-REQUEST": {
    id: "CLASSIFY-REQUEST",
    next: ["REQUEST-ROOT"],
    type: "RequestClassifierResolver",
  },
  "DEFAULT-ATTRIBUTE": {
    id: "DEFAULT-ATTRIBUTE",
    next: ["DEFAULT-ATTRIBUTE:EQUITY", "DEFAULT-ATTRIBUTE:FX"],
    type: "RoutingPlan",
  },
  "DEFAULT-ATTRIBUTE:EQUITY": {
    id: "DEFAULT-ATTRIBUTE:EQUITY",
    next: ["QUOTE:PSE", "QUOTE:TICKER"],
    type: "EquityAttributeResolutionPlan",
  },
  "DEFAULT-ATTRIBUTE:FX": {
    id: "DEFAULT-ATTRIBUTE:FX",
    next: ["FX-IDENTITY", "QUOTE:DEFAULT-FX"],
    type: "FxAttributeResolutionPlan",
  },
  "QUOTE:DEFAULT-FX": {
    id: "QUOTE:DEFAULT-FX",
    next: ["GOOGLE-FX", "YAHOO-FX"],
    type: "AttributeResolutionPlan",
  },
  "QUOTE:PSE": {
    id: "QUOTE:PSE",
    next: ["PSE-FRAMES", "PSE-EDGE"],
    type: "PseQuoteResolutionPlan",
  },
  "QUOTE:TICKER": {
    id: "QUOTE:TICKER",
    next: ["YAHOO-QUOTE", "TRADINGVIEW-FUND"],
    type: "TickerQuoteResolutionPlan",
  },
  "IDENTIFIER-ROOT": {
    id: "IDENTIFIER-ROOT",
    next: ["RESOLVED-IDENTIFIER", "IDENTIFIER:ISIN"],
    type: "RoutingPlan",
  },
  "IDENTIFIER:ISIN": defineGraphNode({
    id: "IDENTIFIER:ISIN",
    next: ["ISIN:PSE", "ISIN:YAHOO"],
    type: "FirstSuccessPlan",
  }),
  "RESOLVED-IDENTIFIER": {
    id: "RESOLVED-IDENTIFIER",
    next: ["TERMINAL"],
    type: "DirectIdentifierResolver",
  },
  "ISIN:PSE": {
    id: "ISIN:PSE",
    next: ["TERMINAL"],
    type: "PseIsinMapResolver",
  },
  "ISIN:YAHOO": {
    id: "ISIN:YAHOO",
    next: ["TERMINAL"],
    type: "YahooIsinSearchResolver",
  },
  "FX-IDENTITY": {
    id: "FX-IDENTITY",
    next: ["TERMINAL"],
    type: "LocalFxResolver",
  },
  "GOOGLE-FX": {
    id: "GOOGLE-FX",
    next: ["TERMINAL"],
    type: "GoogleFxResolver",
  },
  "YAHOO-QUOTE": {
    id: "YAHOO-QUOTE",
    next: ["TERMINAL"],
    type: "YahooEquityQuoteResolver",
  },
  "YAHOO-FX": {
    id: "YAHOO-FX",
    next: ["TERMINAL"],
    type: "YahooFxResolver",
  },
  "TRADINGVIEW-FUND": {
    id: "TRADINGVIEW-FUND",
    next: ["TERMINAL"],
    type: "TradingviewFundResolver",
  },
  "PSE-FRAMES": {
    id: "PSE-FRAMES",
    next: ["TERMINAL"],
    type: "PSEFramesResolver",
  },
  "PSE-EDGE": {
    id: "PSE-EDGE",
    next: ["TERMINAL"],
    type: "PSEEdgeResolver",
  },
  TERMINAL: {
    id: "TERMINAL",
    type: "TerminalCollectorPlan",
  },
};
