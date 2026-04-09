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
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
} = require("../dist/ts/core/index.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

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
    resolverServices: createStaticResolverServices(),
  };
}

test("ResolveFlow builds executable nodes directly from DagPlan", () => {
  const resolveFlow = new ResolveFlow(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.equal(resolveFlow.getGraph().getRoot().id, "ROOT");
  assert.equal(resolveFlow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(
    resolveFlow.getNodeByCode("YAHOO"),
    resolveFlow.nodesByCode.YAHOO,
  );
  assert.equal(
    resolveFlow.getPlanNodeByCode("DEFAULT-ATTRIBUTE"),
    resolveFlow.getNodeByCode("DEFAULT-ATTRIBUTE"),
  );
  assert.equal(
    resolveFlow
      .getPlanNodeByCode("IDENTIFIER:ISIN")
      .describe({ attribute: "price", ticker: "PHY077751022" }),
    "IDENTIFIER:ISIN -> ISIN:PSE -> ISIN:YAHOO",
  );
  assert.equal(resolveFlow.resolveAttribute("USDUSD", "price"), 1);
});

test("ResolveFlow rejects terminal nodes as executable plan lookups", () => {
  const resolveFlow = new ResolveFlow(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.throws(
    () => resolveFlow.getNodeByCode("TERMINAL"),
    /terminal node "TERMINAL" is not executable/i,
  );
});

test("ResolveFlow allows plan nodes to reference TERMINAL without making it executable", () => {
  const resolveFlow = new ResolveFlow(
    {
      ROOT: {
        id: "ROOT",
        next: ["DONE"],
        type: "RoutingPlan",
      },
      DONE: {
        id: "DONE",
        next: ["TERMINAL"],
        type: "RoutingPlan",
      },
      TERMINAL: {
        id: "TERMINAL",
        type: "TerminalCollectorPlan",
      },
    },
    createResolverMaterializationDependencies(),
  );

  const donePlan = resolveFlow.getPlanNodeByCode("DONE");

  assert.equal(donePlan.nodes.length, 1);
  assert.equal(donePlan.nodes[0], null);
  assert.throws(
    () => resolveFlow.getNodeByCode("TERMINAL"),
    /terminal node "TERMINAL" is not executable/i,
  );
});
