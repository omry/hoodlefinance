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
  assert.equal(resolveFlow.getGraph().getNode("YAHOO").type, "YahooQuoteResolver");
  assert.equal(resolveFlow.resolveAttribute("USDUSD", "price"), 1);
});
