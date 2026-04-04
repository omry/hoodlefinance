const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  FunctionValueResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
  RequestInput,
  createConcreteResolverMaterializationDependencies,
  materializeResolversByCode,
  materializePlanFromSpec,
  createDefaultPlanMaterializationDependencies,
  PLAN_SPECS_BY_CODE,
  RESOLVER_SPECS_BY_CODE,
  createDefaultResolvePlanBuilder,
  getRoutingTableRows,
} = require("../dist/ts/core/index.js");

function createIntegratedResolverRegistry() {
  const commonDeps = {
    fetchAllInChunks: () => [],
    fetchText: () => "",
    getCachedString: () => "",
    putCachedString: (k, v) => v,
    getCachedJson: () => null,
    putCachedJson: (k, v) => v,
  };

  const resolveFunctionsByRef = {
    "ATTRIBUTE-IDENTITY": (job) => String(job.routeState.identifier || "").toUpperCase(),
    "ARIVA": () => "ISIN:ARIVA",
    "IBKR": () => "ISIN:IBKR",
    "LON": () => "ISIN:LON",
    "PSE": () => "ISIN:PSE",
    "TRADINGVIEW": () => "ISIN:TRADINGVIEW",
  };

  const resolvePseTickerFromIsinMap = (isin) => (isin === "PHY077751022" ? "PSE:BDO" : "");

  const resolverClassDependenciesByName = {
    DirectIdentifierResolver: {},
    FunctionValueResolver: { resolveFunctionsByRef },
    LocalFxResolver: {},
    PseIsinMapResolver: resolvePseTickerFromIsinMap,
    YahooIsinSearchResolver: commonDeps,
    YahooQuoteResolver: commonDeps,
    TradingviewFundResolver: commonDeps,
    GoogleFxResolver: commonDeps,
    PseFramesResolver: commonDeps,
    PseEdgeResolver: commonDeps,
  };

  return materializeResolversByCode(RESOLVER_SPECS_BY_CODE, {
    resolverClassesByName: {
      DirectIdentifierResolver,
      GoogleFxResolver,
      FunctionValueResolver,
      LocalFxResolver,
      PseEdgeResolver,
      PseFramesResolver,
      PseIsinMapResolver,
      YahooIsinSearchResolver,
      YahooQuoteResolver,
      TradingviewFundResolver,
    },
    resolverClassDependenciesByName,
  });
}

function createIntegratedPlanMaterializer(registry) {
  const deps = createDefaultPlanMaterializationDependencies({
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
    planSpecsByCode: PLAN_SPECS_BY_CODE,
    resolversByCode: registry.byCode,
  });

  return (code, overrides) =>
    materializePlanFromSpec(code, overrides, deps);
}

test("HOODLEFINANCE_ROUTES returns the routing table matching legacy integrated results", () => {
  const registry = createIntegratedResolverRegistry();
  const materializePlanFromSpec = createIntegratedPlanMaterializer(registry);
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: registry.byCode["RESOLVED-IDENTIFIER"],
    materializePlanFromSpec,
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
  const registry = createIntegratedResolverRegistry();
  const materializePlanFromSpec = createIntegratedPlanMaterializer(registry);
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: registry.byCode["RESOLVED-IDENTIFIER"],
    materializePlanFromSpec,
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
  const registry = createIntegratedResolverRegistry();
  
  // Force ambiguity by adding a resolver that handles everything
  const ambiguousSpec = {
    "AMBIGUOUS-EXTRA": {
      nodeCodes: ["YAHOO"],
      resolverClass: "AttributeResolutionPlan",
      options: {
        routingLabel: "AMBIGUOUS-EXTRA",
      }
    }
  };
  
  // We need to inject this into the DEFAULT-ATTRIBUTE node codes
  const modifiedSpecs = JSON.parse(JSON.stringify(PLAN_SPECS_BY_CODE));
  modifiedSpecs["DEFAULT-ATTRIBUTE"].nodeCodes.push("AMBIGUOUS-EXTRA");
  modifiedSpecs["AMBIGUOUS-EXTRA"] = ambiguousSpec["AMBIGUOUS-EXTRA"];

  const deps = createDefaultPlanMaterializationDependencies({
    looksLikeIsin: () => false,
    planSpecsByCode: modifiedSpecs,
    resolversByCode: registry.byCode,
  });

  const materializePlanFromSpecLocal = (code, overrides) =>
    materializePlanFromSpec(code, overrides, deps);

  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: registry.byCode["RESOLVED-IDENTIFIER"],
    materializePlanFromSpec: materializePlanFromSpecLocal,
  });

  assert.throws(
    () => buildResolvePlan(new RequestInput("GOOG", "price", {
      looksLikeIsin: () => false,
      normalizeAttribute: (a) => a,
      parseAttributeRequest: (a) => ({}),
      parseFxTicker: () => null,
      parseTickerRequest: (t) => ({ ticker: t, sourceOverride: "", infoMode: "" }),
    })),
    /Ambiguous default attribute route for classification "equity": EQUITY, AMBIGUOUS-EXTRA\./
  );
});
