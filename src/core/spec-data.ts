import type { Graph } from "./flow/graph";

export const DagPlan: Graph.Definition = {
  ROOT: {
    id: "ROOT",
    type: "RequestClassifierResolver",
    next: ["ATTRIBUTE", "IDENTIFIER:ISIN"],
  },
  ATTRIBUTE: {
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
    group: "FX_CONVERSION",
    id: "ATTRIBUTE:FX",
    next: ["FX-IDENTITY", "QUOTE:FX"],
    type: "FxAttributeResolutionPlan",
  },
  "QUOTE:FX": {
    group: "FX_CONVERSION",
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
    next: ["LON-ISIN", "YAHOO-QUOTE", "TRADINGVIEW-FUND"],
    type: "TickerQuoteResolutionPlan",
  },
  "LON-ISIN": {
    group: "STOCK",
    id: "LON-ISIN",
    next: ["TERMINAL"],
    type: "LonIsinResolver",
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
    group: "FX_CONVERSION",
    id: "FX-IDENTITY",
    next: ["EXTRACT:FX"],
    type: "LocalFxResolver",
  },
  "GOOGLE-FX": {
    group: "FX_CONVERSION",
    id: "GOOGLE-FX",
    next: ["EXTRACT:FX"],
    type: "GoogleFxResolver",
  },
  "YAHOO-QUOTE": {
    group: "STOCK",
    id: "YAHOO-QUOTE",
    next: ["EXTRACT:EQUITY"],
    type: "YahooEquityQuoteResolver",
  },
  "YAHOO-FX": {
    group: "FX_CONVERSION",
    id: "YAHOO-FX",
    next: ["EXTRACT:FX"],
    type: "YahooFxResolver",
  },
  "TRADINGVIEW-FUND": {
    group: "STOCK",
    id: "TRADINGVIEW-FUND",
    next: ["EXTRACT:EQUITY"],
    type: "TradingviewFundResolver",
  },
  "PSE-FRAMES": {
    group: "STOCK",
    id: "PSE-FRAMES",
    next: ["EXTRACT:EQUITY"],
    type: "PSEFramesResolver",
  },
  "PSE-EDGE": {
    group: "STOCK",
    id: "PSE-EDGE",
    next: ["EXTRACT:EQUITY"],
    type: "PSEEdgeResolver",
  },
  "EXTRACT:EQUITY": {
    group: "STOCK",
    id: "EXTRACT:EQUITY",
    next: ["TERMINAL"],
    subgraphCalls: ["FX_CONVERSION"],
    type: "EquityAttributeExtractResolver",
  },
  "EXTRACT:FX": {
    group: "FX_CONVERSION",
    id: "EXTRACT:FX",
    next: ["TERMINAL"],
    type: "FxAttributeExtractResolver",
  },
  TERMINAL: {
    id: "TERMINAL",
    type: "TerminalCollectorPlan",
  },
  __subgraphs__: {
    FX_CONVERSION: {
      rootNodeId: "ATTRIBUTE:FX",
      terminalNodeId: "EXTRACT:FX",
    },
  },
};
