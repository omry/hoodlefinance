const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  ResolveFlow,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
} = require("../dist/ts/core/index.js");

function createResolverMaterializationDependencies() {
  return {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    resolverClassesByName: {
      DirectIdentifierResolver,
      GoogleFxResolver,
      LocalFxResolver,
      PSEEdgeResolver: PseEdgeResolver,
      PSEFramesResolver: PseFramesResolver,
      PseIsinMapResolver,
      RequestClassifierResolver,
      TradingviewFundResolver,
      YahooIsinSearchResolver,
      YahooQuoteResolver,
    },
    resolverServices: {
      httpFetch: (url) =>
        String(url) ===
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
          ? "PHY077751022=PSE:BDO\n"
          : "",
      getCachedJson: () => null,
      getCachedString: () => "",
      putCachedJson: (_key, value) => value,
      putCachedString: (_key, value) => value,
    },
  };
}

test("DagPlan uses the final graph node shape", () => {
  assert.equal(DagPlan.ROOT.id, "ROOT");
  assert.equal(DagPlan.ROOT.type, "RequestClassificationPlan");
  assert.deepEqual(DagPlan.ROOT.next, ["CLASSIFY-REQUEST", "REQUEST-ROOT"]);
  assert.equal(DagPlan["QUOTE:PSE"].type, "PseQuoteResolutionPlan");
  assert.deepEqual(DagPlan["QUOTE:PSE"].next, ["PSE-FRAMES", "PSE-EDGE"]);
});

test("ResolveFlow builds and validates DagPlan directly from the authored graph", () => {
  const resolveFlow = new ResolveFlow(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.equal(resolveFlow.getGraph().getRoot().id, "ROOT");
  assert.equal(resolveFlow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(resolveFlow.getGraph().getNode("QUOTE:PSE").type, "PseQuoteResolutionPlan");
});

test("ResolveFlow validates DAG structure during construction", () => {
  assert.throws(() => {
    new ResolveFlow(
      {
        ROOT: {
          id: "ROOT",
          next: ["MISSING"],
          type: "RoutingPlan",
        },
        TERMINAL: {
          id: "TERMINAL",
          type: "TerminalCollectorPlan",
        },
      },
      createResolverMaterializationDependencies(),
    );
  }, /missing child "MISSING"/i);
});
