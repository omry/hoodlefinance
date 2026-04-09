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

function createResolverMaterializationDependencies() {
  const commonDeps = {
    httpFetch: (url) =>
      String(url) ===
      "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
        ? "PHY077751022=PSE:BDO\n"
        : "",
    getCachedJson: () => null,
    getCachedString: () => "",
    putCachedJson: (_key, value) => value,
    putCachedString: (_key, value) => value,
  };

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
      ...commonDeps,
    },
  };
}

test("ResolveFlow builds executable nodes directly from DagPlan", () => {
  const resolveFlow = ResolveFlow.fromPlanSpecs(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.equal(resolveFlow.dag.root.code, "ROOT");
  assert.equal(resolveFlow.dag.terminal.code, "TERMINAL");
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
});

test("ResolveFlow rejects terminal nodes as executable plan lookups", () => {
  const resolveFlow = ResolveFlow.fromPlanSpecs(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.throws(
    () => resolveFlow.getNodeByCode("TERMINAL"),
    /terminal node "TERMINAL" is not executable/i,
  );
});
