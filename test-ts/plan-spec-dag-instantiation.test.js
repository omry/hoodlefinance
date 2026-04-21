const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  EquityAttributeExtractResolver,
  EquityAttributeResolutionPlan,
  FirstSuccessReceiver,
  FirstSuccessJunction,
  FxAttributeExtractResolver,
  FxAttributeResolutionPlan,
  GoogleFxResolver,
  LocalFxResolver,
  LonIsinResolver,
  NodeFactoryRegistry,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  PseQuoteResolutionPlan,
  RequestClassifierResolver,
  Flow,
  BaseHFResolver,
  RoutingPlan,
  StepJunction,
  TickerQuoteResolutionPlan,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
} = require("../dist/ts/core/index.js");
const {
  createStaticResolverServices,
} = require("./resolver-service-fixtures.js");

class LeafResolver extends BaseHFResolver {
  executeBatch(jobs) {
    return jobs.map(() => ({ quote: null, status: "success" }));
  }
}

function createResolverRegistry() {
  return new NodeFactoryRegistry()
    .register("EquityAttributeExtractResolver", EquityAttributeExtractResolver)
    .register("FirstSuccessReceiver", FirstSuccessReceiver)
    .register("FxAttributeExtractResolver", FxAttributeExtractResolver)
    .register("GoogleFxResolver", GoogleFxResolver)
    .register("LeafResolver", LeafResolver)
    .register("LocalFxResolver", LocalFxResolver)
    .register("LonIsinResolver", LonIsinResolver)
    .register("PSEEdgeResolver", PseEdgeResolver)
    .register("PSEFramesResolver", PseFramesResolver)
    .register("PseIsinMapResolver", PseIsinMapResolver)
    .register("RequestClassifierResolver", RequestClassifierResolver)
    .register("TradingviewFundResolver", TradingviewFundResolver)
    .register("YahooIsinSearchResolver", YahooIsinSearchResolver)
    .register("YahooEquityQuoteResolver", YahooEquityQuoteResolver)
    .register("YahooFxResolver", YahooFxResolver)
    .register(
      "EquityAttributeResolutionPlan",
      EquityAttributeResolutionPlan,
    )
    .register("FirstSuccessPlan", FirstSuccessJunction)
    .register("FxAttributeResolutionPlan", FxAttributeResolutionPlan)
    .register("PseQuoteResolutionPlan", PseQuoteResolutionPlan)
    .register("RoutingPlan", RoutingPlan)
    .register("StepPlan", StepJunction)
    .register("TickerQuoteResolutionPlan", TickerQuoteResolutionPlan);
}

function createValidDagSpecs() {
  return {
    " root ": {
      id: " root ",
      next: [" quote ", "identifier "],
      type: "RoutingPlan",
    },
    QUOTE: {
      id: "QUOTE",
      next: ["TERMINAL"],
      type: "LeafResolver",
    },
    IDENTIFIER: {
      id: "IDENTIFIER",
      next: [" country-leaf ", "fallback-leaf"],
      type: "FirstSuccessPlan",
    },
    " country-leaf ": {
      id: " country-leaf ",
      next: ["TERMINAL"],
      type: "LeafResolver",
    },
    " fallback-leaf ": {
      id: " fallback-leaf ",
      next: ["TERMINAL"],
      type: "LeafResolver",
    },
    TERMINAL: {
      id: "TERMINAL",
      type: "TerminalCollectorPlan",
    },
  };
}

function createValidSubgraphDagSpecs() {
  const definition = createValidDagSpecs();

  definition.QUOTE.subgraphCalls = ["FX"];
  definition.IDENTIFIER.next = ["COUNTRY-LEAF", "FALLBACK-LEAF", "FX:START"];
  definition["FX:START"] = {
    group: "FX",
    id: "FX:START",
    next: ["FX:END"],
    type: "LeafResolver",
  };
  definition["FX:END"] = {
    group: "FX",
    id: "FX:END",
    next: ["TERMINAL"],
    type: "LeafResolver",
  };
  definition.__subgraphs__ = {
    FX: {
      rootNodeId: "FX:START",
      terminalNodeId: "FX:END",
    },
  };

  return definition;
}

function instantiateFlow(definition) {
  return new Flow(
    definition,
    createResolverRegistry(),
    createStaticResolverServices(),
  );
}

test("Flow graph view normalizes and validates DAG structure", async (t) => {
  await t.test("builds a graph view from normalized ordered child ids", () => {
    const graph = instantiateFlow(createValidDagSpecs()).getGraph();

    assert.equal(graph.getRoot().id, "ROOT");
    assert.equal(graph.getTerminal().id, "TERMINAL");
    assert.deepEqual(
      graph.getTopologicalOrder().map((node) => node.id),
      [
        "ROOT",
        "QUOTE",
        "IDENTIFIER",
        "COUNTRY-LEAF",
        "FALLBACK-LEAF",
        "TERMINAL",
      ],
    );
    assert.deepEqual(
      graph.getChildren("ROOT").map((node) => node.id),
      ["QUOTE", "IDENTIFIER"],
    );
    assert.deepEqual(
      graph.getChildren("IDENTIFIER").map((node) => node.id),
      ["COUNTRY-LEAF", "FALLBACK-LEAF"],
    );
    assert.deepEqual(
      graph.getParents("COUNTRY-LEAF").map((node) => node.id),
      ["IDENTIFIER"],
    );
  });

  await t.test("instantiates DagPlan as a valid HOODLEFINANCE graph", () => {
    const graph = instantiateFlow(DagPlan).getGraph();

    assert.equal(graph.getRoot().id, "ROOT");
    assert.equal(graph.getTerminal().id, "TERMINAL");
    assert.equal(graph.getNode("YAHOO-QUOTE").type, "YahooEquityQuoteResolver");
    assert.deepEqual(
      graph.getChildren("IDENTIFIER:ISIN").map((node) => node.id),
      ["ISIN:PSE", "ISIN:YAHOO"],
    );
    assert.deepEqual(graph.getSubgraphIds(), ["FX_CONVERSION"]);
    assert.deepEqual(graph.getSubgraph("FX_CONVERSION"), {
      rootNodeId: "ATTRIBUTE:FX",
      terminalNodeId: "EXTRACT:FX",
    });
    assert.deepEqual(graph.getNode("EXTRACT:EQUITY").subgraphCalls, [
      "FX_CONVERSION",
    ]);
  });

  await t.test(
    "builds declared subgraphs and node-level subgraph call metadata",
    () => {
      const graph = instantiateFlow(
        createValidSubgraphDagSpecs(),
      ).getGraph();

      assert.deepEqual(graph.getSubgraphIds(), ["FX"]);
      assert.deepEqual(graph.getSubgraph("FX"), {
        rootNodeId: "FX:START",
        terminalNodeId: "FX:END",
      });
      assert.deepEqual(graph.getNode("QUOTE").subgraphCalls, ["FX"]);
    },
  );

  await t.test("rejects duplicate normalized codes", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          " root ": {
            id: " root ",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /duplicate normalized code "ROOT"/i,
    );
  });

  await t.test("rejects mismatched keys and node ids", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "NOT-ROOT",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /must match node\.id/i,
    );
  });

  await t.test("rejects missing referenced child nodes", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["MISSING"],
            type: "RoutingPlan",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /references missing child "MISSING"/i,
    );
  });

  await t.test("rejects cycles", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["A"],
            type: "RoutingPlan",
          },
          A: {
            id: "A",
            next: ["ROOT"],
            type: "RoutingPlan",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /contains a cycle/i,
    );
  });

  await t.test("rejects multiple roots", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          ORPHAN: {
            id: "ORPHAN",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /exactly one root; found 2/i,
    );
  });

  await t.test("rejects multiple terminals", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["LEFT", "RIGHT"],
            type: "RoutingPlan",
          },
          LEFT: {
            id: "LEFT",
            next: ["TERMINAL-A"],
            type: "RoutingPlan",
          },
          RIGHT: {
            id: "RIGHT",
            next: ["TERMINAL-B"],
            type: "RoutingPlan",
          },
          "TERMINAL-A": {
            id: "TERMINAL-A",
            type: "TerminalCollectorPlan",
          },
          "TERMINAL-B": {
            id: "TERMINAL-B",
            type: "TerminalCollectorPlan",
          },
        }),
      /exactly one terminal; found 2/i,
    );
  });

  await t.test(
    "rejects node-level subgraph calls that reference undeclared subgraphs",
    () => {
      const definition = createValidDagSpecs();
      definition.QUOTE.subgraphCalls = ["FX"];

      assert.throws(
        () => instantiateFlow(definition),
        /Graph node "QUOTE" references undeclared subgraph "FX"\./,
      );
    },
  );

  await t.test(
    "rejects subgraphs whose terminal is unreachable from the declared root",
    () => {
      const definition = createValidSubgraphDagSpecs();
      definition["FX:START"].next = ["TERMINAL"];
      definition.IDENTIFIER.next = [
        "COUNTRY-LEAF",
        "FALLBACK-LEAF",
        "FX:START",
        "FX:END",
      ];

      assert.throws(
        () => instantiateFlow(definition),
        /Subgraph "FX" terminal node "FX:END" is unreachable from root "FX:START"\./,
      );
    },
  );

  await t.test(
    "rejects subgraphs whose root or terminal does not belong to the declared group",
    () => {
      const definition = createValidSubgraphDagSpecs();
      definition["FX:END"].group = "OTHER";

      assert.throws(
        () => instantiateFlow(definition),
        /Subgraph "FX" terminal node "FX:END" must belong to group "FX"\./,
      );
    },
  );

  await t.test(
    "rejects subgraphs that may execute nodes outside the declared group",
    () => {
      const definition = createValidSubgraphDagSpecs();
      definition["FX:MID"] = {
        id: "FX:MID",
        next: ["FX:END"],
        type: "LeafResolver",
      };
      definition["FX:START"].next = ["FX:MID"];
      definition.IDENTIFIER.next = [
        "COUNTRY-LEAF",
        "FALLBACK-LEAF",
        "FX:START",
        "FX:MID",
      ];

      assert.throws(
        () => instantiateFlow(definition),
        /Subgraph "FX" may execute nodes outside group "FX": FX:MID\./,
      );
    },
  );

  await t.test("rejects nodes unreachable from the root", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["TERMINAL"],
            type: "RoutingPlan",
          },
          BRANCH: {
            id: "BRANCH",
            next: ["DEAD"],
            type: "RoutingPlan",
          },
          DEAD: {
            id: "DEAD",
            next: ["TERMINAL"],
            type: "LeafResolver",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /exactly one root; found 2/i,
    );
  });

  await t.test("rejects nodes that cannot reach the terminal", () => {
    assert.throws(
      () =>
        instantiateFlow({
          ROOT: {
            id: "ROOT",
            next: ["A"],
            type: "RoutingPlan",
          },
          A: {
            id: "A",
            next: ["DEAD", "TERMINAL"],
            type: "RoutingPlan",
          },
          DEAD: {
            id: "DEAD",
            type: "LeafResolver",
          },
          TERMINAL: {
            id: "TERMINAL",
            type: "TerminalCollectorPlan",
          },
        }),
      /exactly one terminal; found 2/i,
    );
  });
});
