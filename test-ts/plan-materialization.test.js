const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractIsinCountryCode,
  createDefaultPlanMaterializationDependencies,
  listSourceOverridePlanCodes,
  materializePlanFromSpec,
  materializePlanNodeByCode,
} = require("../dist/ts/core/index.js");

function createResolver(name) {
  return {
    buildRuntimePlan() {
      return { nodes: [], routeClass: "", routePath: "", routeState: {} };
    },
    canHandle() {
      return true;
    },
    code: name,
    describe() {
      return name;
    },
    name,
    routingDescription: "",
    routingLabel: name,
    sourceName: name,
  };
}

test("extractIsinCountryCode handles bare and prefixed ISIN requests", () => {
  const looksLikeIsin = (value) =>
    /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));

  assert.equal(
    extractIsinCountryCode(
      { ticker: "US02079K1079", upperTicker: "US02079K1079" },
      looksLikeIsin,
    ),
    "US",
  );
  assert.equal(
    extractIsinCountryCode(
      { ticker: "ISIN:ph0000056814", upperTicker: "ISIN:PH0000056814" },
      looksLikeIsin,
    ),
    "PH",
  );
  assert.equal(
    extractIsinCountryCode(
      { ticker: "GOOG", upperTicker: "GOOG" },
      looksLikeIsin,
    ),
    "",
  );
});

test("plan materialization returns resolvers, builds plans, and validates bad inputs", () => {
  const yahoo = createResolver("YAHOO");
  const deps = {
    buildPlanNode(code, spec, resolveNode, overrides) {
      return {
        buildRuntimePlan() {
          return { nodes: [], routeClass: "", routePath: "", routeState: {} };
        },
        canHandle() {
          return true;
        },
        code,
        describe() {
          return `${code}:${spec.resolverClass}:${Object.keys(overrides).length}`;
        },
        name: code,
        resolvedChildren: (spec.nodeCodes || []).map(resolveNode),
        routingDescription: "",
        routingLabel: code,
        sourceName: code,
      };
    },
    planSpecsByCode: {
      ROOT: {
        nodeCodes: ["YAHOO"],
        resolverClass: "ResolverPlan",
      },
      SOURCEABLE: {
        options: { isSourceOverrideable: true },
        resolverClass: "ResolverPlan",
      },
    },
    resolversByCode: {
      YAHOO: yahoo,
    },
  };

  assert.equal(materializePlanNodeByCode("YAHOO", null, [], deps), yahoo);
  assert.equal(
    materializePlanFromSpec("ROOT", { foo: "bar" }, deps).describe(),
    "ROOT:ResolverPlan:1",
  );
  assert.deepEqual(listSourceOverridePlanCodes(deps.planSpecsByCode), [
    "SOURCEABLE",
  ]);

  assert.throws(
    () => materializePlanNodeByCode("MISSING", null, [], deps),
    /Unknown resolver plan spec/,
  );
  assert.throws(
    () => materializePlanNodeByCode("ROOT", null, ["ROOT"], deps),
    /cycle detected/,
  );
  assert.throws(
    () =>
      materializePlanNodeByCode("YAHOO", null, [], {
        ...deps,
        planSpecsByCode: {
          ...deps.planSpecsByCode,
          YAHOO: { resolverClass: "ResolverPlan" },
        },
      }),
    /collides with a resolver plan spec/,
  );
});

test("default plan materialization builds typed resolver plans from runtime refs", () => {
  const yahoo = createResolver("YAHOO");
  const tradingview = createResolver("TRADINGVIEW-FUND");
  const deps = createDefaultPlanMaterializationDependencies({
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    planSpecsByCode: {
      "QUOTE:TICKER": {
        nodeCodes: ["YAHOO", "TRADINGVIEW-FUND"],
        resolverClass: "AttributeResolutionPlan",
        options: {
          routeClassRef: "EQUITY_TICKER_CLASS",
          routePathRef: "EQUITY_TICKER_PATH",
          routeStateBuilderRef: "EQUITY_YAHOO_QUOTE",
        },
      },
    },
    resolvePreferredYahooSymbol(symbol) {
      return `${symbol}:ALT`;
    },
    resolversByCode: {
      "TRADINGVIEW-FUND": tradingview,
      YAHOO: yahoo,
    },
  });

  const plan = materializePlanFromSpec("QUOTE:TICKER", null, deps);
  const runtimePlan = plan.buildRuntimePlan({
    allowTradingviewFallback: true,
    classification: "equity",
    input: { attribute: "price", identifier: "GOOG" },
    requestType: "equity",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  });

  assert.equal(runtimePlan.routeClass, "EQUITY -> TICKER");
  assert.equal(runtimePlan.routePath, "YAHOO -> TRADINGVIEW");
  assert.deepEqual(runtimePlan.routeState, {
    fxPair: null,
    preferredYahooSymbol: "GOOG:ALT",
    yahooSymbol: "GOOG",
  });
});
