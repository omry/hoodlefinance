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
  RequestInput,
  TradingviewFundResolver,
  compileDagPlanForLegacyExecution,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  createDefaultResolvePlanBuilder,
} = require("../dist/ts/core/index.js");

function createResolverMaterializationDependencies() {
  const commonDeps = {
    httpFetch: () => "",
    getCachedJson: () => null,
    getCachedString: () => "",
    putCachedJson: (_key, value) => value,
    putCachedString: (_key, value) => value,
  };
  const resolvePseTickerFromIsinMap = (isin) =>
    isin === "PHY077751022" ? "PSE:BDO" : "";

  return {
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
      resolvePseTickerFromIsinMap,
    },
  };
}

function createRequestInput(identifier, attribute = "price") {
  return new RequestInput(identifier, attribute, {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    normalizeAttribute: (value) => String(value || "price"),
    parseAttributeRequest: (value) => ({
      baseAttribute: value,
      outputCode: "",
      rawAttribute: value,
      wantsOutputCurrency: false,
    }),
    parseFxTicker: (ticker) => {
      const normalized = String(ticker || "").trim().toUpperCase();

      if (normalized === "EURUSD") {
        return {
          baseCanonicalCode: "EUR",
          quoteCanonicalCode: "USD",
          yahooChartSymbol: "EURUSD=X",
        };
      }

      if (normalized === "USDUSD") {
        return {
          baseCanonicalCode: "USD",
          quoteCanonicalCode: "USD",
          yahooChartSymbol: "USDUSD=X",
        };
      }

      return null;
    },
    parseTickerRequest: (ticker) => ({
      infoMode: "",
      sourceOverride: "",
      ticker,
    }),
  });
}

function createBuildResolvePlanFromCompiledDag() {
  const compiledDagPlan = compileDagPlanForLegacyExecution(
    DagPlan,
    {
      ...createResolverMaterializationDependencies(),
      looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    },
  );

  return createDefaultResolvePlanBuilder({
    directIdentifierResolver: compiledDagPlan.getNodeByCode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode(code) {
      return compiledDagPlan.getPlanNodeByCode(code);
    },
  });
}

function summarizeResolvePlan(plan) {
  return {
    attributeRoute:
      plan.attributePlan && plan.resolvedRequest
        ? plan.attributePlan.describe(plan.resolvedRequest)
        : null,
    hasResolvedRequest: !!plan.resolvedRequest,
    identifierRoute: plan.identifierPlan
      ? plan.identifierPlan.describe(plan.requestInput)
      : null,
    plannedRoute: plan.plannedRoute,
  };
}

test("compiled DagPlan preserves representative planned routes", () => {
  const buildDagResolvePlan = createBuildResolvePlanFromCompiledDag();
  const cases = [
    {
      example: "GOOG",
      expectedRoute: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
    },
    {
      example: "PSE:BDO",
      expectedRoute: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER",
    },
    {
      example: "EURUSD",
      expectedRoute: "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
    },
    {
      example: "USDUSD",
      expectedRoute: "DEFAULT-ATTRIBUTE:FX -> FX-IDENTITY",
    },
    {
      example: "US02079K1079",
      expectedRoute: "IDENTIFIER:ISIN -> ISIN:YAHOO",
    },
    {
      example: "PHY077751022",
      expectedRoute: "IDENTIFIER:ISIN -> ISIN:PSE -> ISIN:YAHOO",
    },
  ];

  for (const { example, expectedRoute } of cases) {
    const requestInput = createRequestInput(example, "price");
    const dagPlan = buildDagResolvePlan(requestInput);

    assert.equal(dagPlan.plannedRoute, expectedRoute, `${example} plannedRoute`);
    assert.deepEqual(summarizeResolvePlan(dagPlan), {
      attributeRoute:
        dagPlan.attributePlan && dagPlan.resolvedRequest
          ? dagPlan.attributePlan.describe(dagPlan.resolvedRequest)
          : null,
      hasResolvedRequest: !!dagPlan.resolvedRequest,
      identifierRoute: dagPlan.identifierPlan
        ? dagPlan.identifierPlan.describe(dagPlan.requestInput)
        : null,
      plannedRoute: expectedRoute,
    });
  }
});
