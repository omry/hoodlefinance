const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  FirstSuccessReceiver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  ResolveFlow,
  RouteExecutionResolver,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
} = require("../dist/ts/core/index.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

class LeafResolver extends RouteExecutionResolver {
  executeBatch(jobs) {
    return jobs.map(() => ({ quote: null, status: "success" }));
  }
}

function createResolverMaterializationDependencies() {
  return {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    resolverClassesByName: {
      FirstSuccessReceiver,
      GoogleFxResolver,
      LeafResolver,
      LocalFxResolver,
      PSEEdgeResolver: PseEdgeResolver,
      PSEFramesResolver: PseFramesResolver,
      PseIsinMapResolver,
      RequestClassifierResolver,
      TradingviewFundResolver,
      YahooIsinSearchResolver,
      YahooEquityQuoteResolver,
      YahooFxResolver,
    },
    resolverServices: createStaticResolverServices(),
  };
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

function instantiateResolveFlow(definition) {
  return new ResolveFlow(definition, createResolverMaterializationDependencies());
}

test("ResolveFlow graph view normalizes and validates DAG structure", async (t) => {
  await t.test("builds a graph view from normalized ordered child ids", () => {
    const graph = instantiateResolveFlow(createValidDagSpecs()).getGraph();

    assert.equal(graph.getRoot().id, "ROOT");
    assert.equal(graph.getTerminal().id, "TERMINAL");
    assert.deepEqual(
      graph.getTopologicalOrder().map((node) => node.id),
      ["ROOT", "QUOTE", "IDENTIFIER", "COUNTRY-LEAF", "FALLBACK-LEAF", "TERMINAL"],
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
    const graph = instantiateResolveFlow(DagPlan).getGraph();

    assert.equal(graph.getRoot().id, "ROOT");
    assert.equal(graph.getTerminal().id, "TERMINAL");
    assert.equal(graph.getNode("YAHOO-QUOTE").type, "YahooEquityQuoteResolver");
    assert.deepEqual(
      graph.getChildren("IDENTIFIER:ISIN").map((node) => node.id),
      ["ISIN:PSE", "ISIN:YAHOO"],
    );
  });

  await t.test("rejects duplicate normalized codes", () => {
    assert.throws(
      () =>
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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

  await t.test("rejects nodes unreachable from the root", () => {
    assert.throws(
      () =>
        instantiateResolveFlow({
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
        instantiateResolveFlow({
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
