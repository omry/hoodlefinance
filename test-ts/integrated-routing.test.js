const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
  DagPlan,
  RequestInput,
  compileDagPlanForLegacyExecution,
  createDefaultResolvePlanBuilder,
  getRoutingTableRows,
} = require("../dist/ts/core/index.js");

function createResolverMaterializationDependencies() {
  const commonDeps = {
    httpFetch: (url) =>
      String(url) ===
      "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
        ? "PHY077751022=PSE:BDO\n"
        : "",
    getCachedString: () => "",
    putCachedString: (k, v) => v,
    getCachedJson: () => null,
    putCachedJson: (k, v) => v,
  };

  return {
    resolverClassesByName: {
      DirectIdentifierResolver,
      GoogleFxResolver,
      LocalFxResolver,
      PSEEdgeResolver: PseEdgeResolver,
      PSEFramesResolver: PseFramesResolver,
      PseIsinMapResolver,
      RequestClassifierResolver,
      YahooIsinSearchResolver,
      YahooQuoteResolver,
      TradingviewFundResolver,
    },
    resolverServices: {
      ...commonDeps,
    },
  };
}

function createIntegratedCompiledDag(planSpecsByCode = DagPlan) {
  return compileDagPlanForLegacyExecution(planSpecsByCode, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });
}

test("HOODLEFINANCE_ROUTES returns the routing table matching legacy integrated results", () => {
  const compiledDag = createIntegratedCompiledDag();
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: compiledDag.getNodeByCode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode: compiledDag.getPlanNodeByCode,
  });

  const deps = {
    buildResolvePlan,
    createRequestInput: (id, attr) => new RequestInput(id, attr, {
      looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
      normalizeAttribute: (a) => String(a || "price"),
      parseAttributeRequest: (a) => ({ baseAttribute: a, outputCode: "", rawAttribute: a, wantsOutputCurrency: false }),
      parseFxTicker: () => null, // Simplified for this test
      parseTickerRequest: (t) => ({ infoMode: t.endsWith("@") ? "source-list" : t.endsWith("@?") ? "source-name" : "", sourceOverride: "", ticker: t.replace(/@\??$/, "") }),
    }),
  };

  const rows = getRoutingTableRows(deps);
  const findRow = (example) => rows.find(r => r.example === example);

  // Partial match checks based on legacy test expectations
  // Partial match checks based on actual TS integrated results
  assert.equal(findRow("GOOG").route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(findRow("EURUSD").route, "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX");
  assert.equal(findRow("USDUSD").route, "DEFAULT-ATTRIBUTE:FX -> FX-IDENTITY");
  assert.equal(findRow("PSE:BDO").route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER");

  // Specific planned route check
  const googPlan = buildResolvePlan(deps.createRequestInput("GOOG", "price"));
  assert.equal(googPlan.plannedRoute, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
});

test("forced PSE sub-sources use the requested individual provider in integrated mode", () => {
  const compiledDag = createIntegratedCompiledDag();
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: compiledDag.getNodeByCode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode: compiledDag.getPlanNodeByCode,
  });

  const framesPlan = buildResolvePlan(new RequestInput("PSE:BDO@PSE-FRAMES", "price", {
    looksLikeIsin: () => false,
    normalizeAttribute: (a) => a,
    parseAttributeRequest: (a) => ({}),
    parseFxTicker: () => null,
    parseTickerRequest: (t) => ({ ticker: "PSE:BDO", sourceOverride: "PSE-FRAMES", infoMode: "" }),
  }));

  assert.equal(framesPlan.attributePlan.name, "PSE-FRAMES");
  assert.equal(framesPlan.plannedRoute, "EQUITY -> PSE -> PSE-FRAMES");

  const edgePlan = buildResolvePlan(new RequestInput("PSE:BDO@PSE-EDGE", "price", {
    looksLikeIsin: () => false,
    normalizeAttribute: (a) => a,
    parseAttributeRequest: (a) => ({}),
    parseFxTicker: () => null,
    parseTickerRequest: (t) => ({ ticker: "PSE:BDO", sourceOverride: "PSE-EDGE", infoMode: "" }),
  }));

  assert.equal(edgePlan.attributePlan.name, "PSE-EDGE");
  assert.equal(edgePlan.plannedRoute, "EQUITY -> PSE -> PSE-EDGE");
});

test("integrated routing errors on ambiguous default attribute plans", () => {
  // Force ambiguity by adding a resolver that handles everything
  const ambiguousSpec = {
    "AMBIGUOUS-EXTRA": {
      nodeCodes: ["YAHOO"],
      resolverClass: "AttributeResolutionPlan",
    },
  };

  // We need to inject this into the DEFAULT-ATTRIBUTE node codes
  const modifiedSpecs = JSON.parse(JSON.stringify(DagPlan));
  modifiedSpecs["DEFAULT-ATTRIBUTE"].nodeCodes.push("AMBIGUOUS-EXTRA");
  modifiedSpecs["AMBIGUOUS-EXTRA"] = ambiguousSpec["AMBIGUOUS-EXTRA"];
  const compiledDag = createIntegratedCompiledDag(modifiedSpecs);

  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: compiledDag.getNodeByCode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode: compiledDag.getPlanNodeByCode,
  });

  assert.throws(
    () => buildResolvePlan(new RequestInput("GOOG", "price", {
      looksLikeIsin: () => false,
      normalizeAttribute: (a) => a,
      parseAttributeRequest: (a) => ({}),
      parseFxTicker: () => null,
      parseTickerRequest: (t) => ({ ticker: t, sourceOverride: "", infoMode: "" }),
    })),
    /Ambiguous default attribute route for classification "equity": DEFAULT-ATTRIBUTE:EQUITY, AMBIGUOUS-EXTRA\./
  );
});
