const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AttributeResolutionPlan,
  FirstSuccessPlan,
  RawRequestInput,
  RequestClassificationPlan,
  RequestInput,
  PseQuoteResolutionPlan,
  ResolverPlan,
  RouteExecutionResolver,
  TickerQuoteResolutionPlan,
  buildPlanNodeFromSpec,
} = require("../dist/ts/core/index.js");

function createRequestInput(overrides = {}) {
  return new RequestInput({
    attribute: overrides.attribute || "price",
    attributeRequest: {
      baseAttribute: overrides.attributeType === "isin" ? "isin" : "price",
      outputCode: "",
      rawAttribute: overrides.attribute || "price",
      wantsOutputCurrency: false,
    },
    attributeType: overrides.attributeType || "quote",
    classification: overrides.classification || "equity",
    fxPair: overrides.fxPair || null,
    identifier: overrides.identifier || "GOOG",
    infoMode: overrides.infoMode || "",
    sourceOverride: overrides.sourceOverride || "",
    ticker: overrides.ticker || overrides.identifier || "GOOG",
    upperTicker: (
      overrides.ticker ||
      overrides.identifier ||
      "GOOG"
    ).toUpperCase(),
  });
}

function createLeafResolver(name, extra = {}) {
  class LeafResolver extends RouteExecutionResolver {
    constructor() {
      super(name, extra.traceLabel || name, extra.sourceName || name, extra);
    }

    canHandle(request) {
      return typeof extra.canHandle === "function"
        ? extra.canHandle(request)
        : true;
    }

    executeBatch(jobs) {
      return jobs.map(() => ({ quote: name, status: "success" }));
    }
  }

  return new LeafResolver();
}

test("ResolverPlan maintains standard fallback sequence and full routing-tree visibility", () => {
  const yahoo = createLeafResolver("YAHOO");
  const ibkr = createLeafResolver("IBKR");

  const plan = new ResolverPlan("QUOTE", [yahoo, ibkr], {
    isRoutingNode: false,
    routePath: "",
  });

  const request = createRequestInput();

  assert.deepEqual(
    plan.getNodesForRequest(request).map((node) => node.name),
    ["YAHOO", "IBKR"],
  );
  assert.deepEqual(
    plan.getRoutingNodes().map((node) => node.name),
    ["YAHOO", "IBKR"],
  );
  assert.equal(plan.buildRoutePath(request), "YAHOO -> IBKR");
});

test("RequestClassificationPlan routes raw inputs to the classifier node", () => {
  const classifier = createLeafResolver("CLASSIFY-REQUEST");
  const requestRoot = createLeafResolver("REQUEST-ROOT");
  const plan = new RequestClassificationPlan("ROOT", [classifier, requestRoot]);

  assert.deepEqual(
    plan
      .getNodesForRequest(new RawRequestInput("GOOG", "price"))
      .map((node) => node.name),
    ["CLASSIFY-REQUEST"],
  );
  assert.deepEqual(
    plan.getNodesForRequest(createRequestInput()).map((node) => node.name),
    ["REQUEST-ROOT"],
  );
});

test("buildPlanNodeFromSpec builds a TickerQuoteResolutionPlan without plan-owned route state", () => {
  const yahoo = createLeafResolver("YAHOO");
  const tradingview = createLeafResolver("TRADINGVIEW-FUND", {
    sourceName: "TRADINGVIEW",
  });
  const refs = {
    resolveFlow: {},
  };

  const plan = buildPlanNodeFromSpec(
    "QUOTE:TICKER",
    {
      id: "QUOTE:TICKER",
      next: ["YAHOO", "TRADINGVIEW-FUND"],
      options: {
        routeClassRef: "EQUITY_TICKER_CLASS",
        routePathRef: "EQUITY_TICKER_PATH",
      },
      type: "TickerQuoteResolutionPlan",
    },
    (nodeCode) =>
      ({
        "TRADINGVIEW-FUND": tradingview,
        YAHOO: yahoo,
      })[nodeCode],
    null,
    { refs },
  );

  assert.equal(plan instanceof TickerQuoteResolutionPlan, true);
  assert.equal(plan.refs, refs);

  const runtimePlan = plan.buildRuntimePlan({
    allowTradingviewFallback: true,
    classification: "equity",
    input: { attribute: "price", identifier: "GOOG" },
    requestType: "equity",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  });

  assert.equal(runtimePlan.routeClass, "QUOTE:TICKER");
  assert.equal(runtimePlan.routePath, "YAHOO -> TRADINGVIEW-FUND");
  assert.deepEqual(runtimePlan.routeState, {});
});

test("buildPlanNodeFromSpec preserves unresolved child slots like the runtime materializer", () => {
  const refs = {
    resolveFlow: {},
  };

  const plan = buildPlanNodeFromSpec(
    "ROOT",
    {
      id: "ROOT",
      next: ["MISSING"],
      type: "RoutingPlan",
    },
    () => null,
    null,
    { refs },
  );

  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0], null);
});

test("FirstSuccessPlan can express ISIN-country fallback through child canHandle ordering", () => {
  const pseMap = createLeafResolver("ISIN:PSE", {
    canHandle(request) {
      return /^PH[A-Z0-9]{10}$/i.test(String(request.ticker || ""));
    },
  });
  const yahooIsin = createLeafResolver("ISIN:YAHOO", {
    canHandle(request) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(request.ticker || ""));
    },
  });
  const refs = {
    resolveFlow: {},
  };

  const plan = buildPlanNodeFromSpec(
    "IDENTIFIER:ISIN",
    {
      id: "IDENTIFIER:ISIN",
      next: ["ISIN:PSE", "ISIN:YAHOO"],
      type: "FirstSuccessPlan",
    },
    (nodeCode) =>
      ({
        "ISIN:PSE": pseMap,
        "ISIN:YAHOO": yahooIsin,
      })[nodeCode],
    null,
    { refs },
  );

  assert.equal(plan instanceof FirstSuccessPlan, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.name),
    ["ISIN:PSE", "ISIN:YAHOO"],
  );
  assert.deepEqual(
    plan
      .getNodesForRequest(createRequestInput({ ticker: "PHY077751022" }))
      .map((node) => node.name),
    ["ISIN:PSE", "ISIN:YAHOO"],
  );
  assert.deepEqual(
    plan
      .getNodesForRequest(createRequestInput({ ticker: "US02079K1079" }))
      .map((node) => node.name),
    ["ISIN:YAHOO"],
  );
});

test("PseQuoteResolutionPlan materializes as the dedicated PSE quote plan", () => {
  const pseFrames = createLeafResolver("PSE-FRAMES");
  const pseEdge = createLeafResolver("PSE-EDGE");
  const refs = {
    resolveFlow: {},
  };

  const plan = buildPlanNodeFromSpec(
    "QUOTE:PSE",
    {
      id: "QUOTE:PSE",
      next: ["PSE-FRAMES", "PSE-EDGE"],
      type: "PseQuoteResolutionPlan",
    },
    (nodeCode) =>
      ({
        "PSE-EDGE": pseEdge,
        "PSE-FRAMES": pseFrames,
      })[nodeCode],
    null,
    { refs },
  );

  assert.equal(plan instanceof PseQuoteResolutionPlan, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.name),
    ["PSE-FRAMES", "PSE-EDGE"],
  );
});

test("ResolverPlan can resolve output-currency conversion through ResolveFlow", () => {
  const refs = {
    resolveFlow: {
      getPlanNodeByCode(code) {
        assert.equal(code, "DEFAULT-ATTRIBUTE:FX");
        return {
          describe() {
            return "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX";
          },
          resolve(request) {
            assert.equal(request.fxPair.yahooChartSymbol, "PHPUSD=X");
            return {
              status: "success",
              value: {
                currency: "USD",
                regularMarketPrice: 0.02,
              },
            };
          },
        };
      },
    },
  };
  const plan = buildPlanNodeFromSpec(
    "QUOTE:TICKER",
    {
      id: "QUOTE:TICKER",
      next: ["YAHOO"],
      type: "TickerQuoteResolutionPlan",
    },
    () => createLeafResolver("YAHOO"),
    null,
    { refs },
  );
  const request = new RequestInput({
    attribute: "price@USD",
    attributeRequest: {
      baseAttribute: "price",
      outputCode: "USD",
      rawAttribute: "price@USD",
      wantsOutputCurrency: true,
    },
    attributeType: "quote",
    classification: "equity",
    fxPair: null,
    identifier: "BDO",
    infoMode: "",
    sourceOverride: "",
    ticker: "PSE:BDO",
  });

  const env = plan.resolveOutputCurrencyEnvelope(request, {
    currency: "PHP",
    regularMarketPrice: 100,
  });

  assert.deepEqual(env, {
    attemptedRoutes: ["DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX"],
    kind: "quote",
    route: "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
    status: "success",
    value: 0.02,
  });
});
