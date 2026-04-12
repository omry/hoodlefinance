import type { Graph } from "./graph";

export const DagPlan: Graph.Definition = {
  ROOT: {
    id: "ROOT",
    type: "RequestClassifierResolver",
    next: ["ATTRIBUTE", "IDENTIFIER:ISIN"],
  },
  "ATTRIBUTE": {
    id: "ATTRIBUTE",
    next: ["ATTRIBUTE:EQUITY", "ATTRIBUTE:FX"],
    type: "RoutingPlan",
  },
  "ATTRIBUTE:EQUITY": {
    group: "STOCK",
    id: "ATTRIBUTE:EQUITY",
    next: ["QUOTE:PSE", "QUOTE:TICKER"],
    type: "EquityAttributeResolutionPlan",
  },
  "ATTRIBUTE:FX": {
    group: "FX",
    id: "ATTRIBUTE:FX",
    next: ["FX-IDENTITY", "QUOTE:FX"],
    type: "FxAttributeResolutionPlan",
  },
  "QUOTE:FX": {
    group: "FX",
    id: "QUOTE:FX",
    next: ["GOOGLE-FX", "YAHOO-FX"],
    type: "FirstSuccessPlan",
  },
  "QUOTE:PSE": {
    group: "STOCK",
    id: "QUOTE:PSE",
    next: ["PSE-FRAMES", "PSE-EDGE"],
    type: "PseQuoteResolutionPlan",
  },
  "QUOTE:TICKER": {
    group: "STOCK",
    id: "QUOTE:TICKER",
    next: ["YAHOO-QUOTE", "TRADINGVIEW-FUND"],
    type: "TickerQuoteResolutionPlan",
  },
  "IDENTIFIER:ISIN": {
    group: "ISIN",
    id: "IDENTIFIER:ISIN",
    next: ["ISIN:PSE", "ISIN:YAHOO"],
    type: "FirstSuccessPlan",
  },
  "ISIN-RECEIVER": {
    group: "ISIN",
    id: "ISIN-RECEIVER",
    next: ["ATTRIBUTE"],
    type: "FirstSuccessReceiver",
  },
  "ISIN:PSE": {
    group: "ISIN",
    id: "ISIN:PSE",
    next: ["ISIN-RECEIVER"],
    type: "PseIsinMapResolver",
  },
  "ISIN:YAHOO": {
    group: "ISIN",
    id: "ISIN:YAHOO",
    next: ["ISIN-RECEIVER"],
    type: "YahooIsinSearchResolver",
  },
  "FX-IDENTITY": {
    group: "FX",
    id: "FX-IDENTITY",
    next: ["TERMINAL"],
    type: "LocalFxResolver",
  },
  "GOOGLE-FX": {
    group: "FX",
    id: "GOOGLE-FX",
    next: ["TERMINAL"],
    type: "GoogleFxResolver",
  },
  "YAHOO-QUOTE": {
    group: "STOCK",
    id: "YAHOO-QUOTE",
    next: ["TERMINAL"],
    type: "YahooEquityQuoteResolver",
  },
  "YAHOO-FX": {
    group: "FX",
    id: "YAHOO-FX",
    next: ["TERMINAL"],
    type: "YahooFxResolver",
  },
  "TRADINGVIEW-FUND": {
    group: "STOCK",
    id: "TRADINGVIEW-FUND",
    next: ["TERMINAL"],
    type: "TradingviewFundResolver",
  },
  "PSE-FRAMES": {
    group: "STOCK",
    id: "PSE-FRAMES",
    next: ["TERMINAL"],
    type: "PSEFramesResolver",
  },
  "PSE-EDGE": {
    group: "STOCK",
    id: "PSE-EDGE",
    next: ["TERMINAL"],
    type: "PSEEdgeResolver",
  },
  TERMINAL: {
    id: "TERMINAL",
    type: "TerminalCollectorPlan",
  },
};
