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
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
  compileDagPlanForLegacyExecution,
} = require("../dist/ts/core/index.js");

function createResolverMaterializationDependencies() {
  const commonDeps = {
    httpFetch: () => "",
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
      TradingviewFundResolver,
      YahooIsinSearchResolver,
      YahooQuoteResolver,
    },
    resolverServices: {
      ...commonDeps,
      resolvePseTickerFromIsinMap: () => "",
    },
  };
}

test("compileDagPlanForLegacyExecution builds executable nodes directly from DagPlan", () => {
  const compiled = compileDagPlanForLegacyExecution(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.equal(compiled.dag.root.code, "ROOT");
  assert.equal(compiled.dag.terminal.code, "TERMINAL");
  assert.equal(compiled.getNodeByCode("YAHOO"), compiled.resolverNodesByCode.YAHOO);
  assert.equal(
    compiled.getPlanNodeByCode("DEFAULT-ATTRIBUTE"),
    compiled.planNodesByCode["DEFAULT-ATTRIBUTE"],
  );
  assert.equal(
    compiled
      .getPlanNodeByCode("IDENTIFIER:ISIN")
      .describe({ attribute: "price", ticker: "PHY077751022" }),
    "IDENTIFIER:ISIN -> ISIN:PSE -> ISIN:YAHOO",
  );
});

test("compileDagPlanForLegacyExecution rejects terminal nodes as executable plan lookups", () => {
  const compiled = compileDagPlanForLegacyExecution(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.throws(
    () => compiled.getNodeByCode("TERMINAL"),
    /terminal node "TERMINAL" is not executable/i,
  );
});
