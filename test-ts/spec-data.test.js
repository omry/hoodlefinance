const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  EquityAttributeExtractResolver,
  FirstSuccessReceiver,
  FxAttributeExtractResolver,
  GoogleFxResolver,
  LocalFxResolver,
  LonIsinResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  ResolveFlow,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
} = require("../dist/ts/core/index.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

function createResolverMaterializationDependencies() {
  return {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    resolverClassesByName: {
      EquityAttributeExtractResolver,
      FirstSuccessReceiver,
      FxAttributeExtractResolver,
      GoogleFxResolver,
      LocalFxResolver,
      LonIsinResolver,
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

test("DagPlan uses the final graph node shape", () => {
  assert.equal(DagPlan.ROOT.id, "ROOT");
  assert.equal(DagPlan.ROOT.type, "RequestClassifierResolver");
  assert.deepEqual(
    DagPlan.ROOT.next,
    ["ATTRIBUTE", "IDENTIFIER:ISIN"],
  );
  assert.equal(DagPlan["QUOTE:PSE"].type, "PseQuoteResolutionPlan");
  assert.deepEqual(DagPlan["QUOTE:PSE"].next, ["PSE-FRAMES", "PSE-EDGE"]);
  assert.deepEqual(DagPlan["EXTRACT:EQUITY"].subgraphCalls, ["FX_CONVERSION"]);
  assert.equal(DagPlan["EXTRACT:FX"].subgraphCalls, undefined);
  assert.deepEqual(DagPlan.__subgraphs__, {
    FX_CONVERSION: {
      rootNodeId: "ATTRIBUTE:FX",
      terminalNodeId: "EXTRACT:FX",
    },
  });
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
