const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FirstSuccessPlan,
  RawRequestInput,
  RequestInput,
  PseQuoteResolutionPlan,
  ResolverPlan,
  RouteExecutionResolver,
  StepPlan,
  SwitchPlan,
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

    executeRouteRequest() {
      return { quote: name, status: "success" };
    }
  }

  return new LeafResolver();
}

test("ResolverPlan describe reports the route without building a runtime plan", () => {
  const plan = new FirstSuccessPlan("QUOTE", [
    createLeafResolver("YAHOO"),
    createLeafResolver("IBKR"),
  ]);

  assert.equal(plan.describe(createRequestInput()), "QUOTE -> YAHOO -> IBKR");
});

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

test("StepPlan forwards to all children without request-based selection", () => {
  const first = createLeafResolver("FIRST", {
    canHandle() {
      return false;
    },
  });
  const second = createLeafResolver("SECOND");
  const plan = new StepPlan("ROOT", [first, second]);

  assert.deepEqual(
    plan.getNodesForRequest(new RawRequestInput("GOOG", "price")).map((node) => node.name),
    ["FIRST", "SECOND"],
  );
  assert.deepEqual(
    plan.getNodesForRequest(createRequestInput()).map((node) => node.name),
    ["FIRST", "SECOND"],
  );
});

test("SwitchPlan selectNext returns the selected child only once per context", () => {
  const yahoo = createLeafResolver("YAHOO");
  const ibkr = createLeafResolver("IBKR", {
    canHandle() {
      return false;
    },
  });
  const plan = new SwitchPlan("QUOTE", [ibkr, yahoo]);
  const context = {};

  assert.deepEqual(plan.selectNext(createRequestInput(), context), [yahoo]);
  assert.deepEqual(plan.selectNext(createRequestInput(), context), []);
});

test("FirstSuccessPlan selectNext advances across handleable children", () => {
  const skipped = createLeafResolver("SKIPPED", {
    canHandle() {
      return false;
    },
  });
  const yahoo = createLeafResolver("YAHOO");
  const ibkr = createLeafResolver("IBKR");
  const plan = new FirstSuccessPlan("QUOTE", [skipped, yahoo, ibkr]);
  const context = {};
  const request = createRequestInput();

  assert.deepEqual(plan.selectNext(request, context), [yahoo]);
  assert.deepEqual(plan.selectNext(request, context), [ibkr]);
  assert.deepEqual(plan.selectNext(request, context), []);
});

test("StepPlan selectNext returns all children and rejects unhandleable output", () => {
  const first = createLeafResolver("FIRST");
  const second = createLeafResolver("SECOND");
  const plan = new StepPlan("ROOT", [first, second]);
  const request = createRequestInput();

  assert.deepEqual(plan.selectNext(request, {}), [first, second]);

  const failingPlan = new StepPlan("ROOT", [
    createLeafResolver("FIRST"),
    createLeafResolver("SECOND", {
      canHandle() {
        return false;
      },
    }),
  ]);

  assert.throws(
    () => failingPlan.selectNext(request, {}),
    /cannot handle the current output/i,
  );
});

test("buildPlanNodeFromSpec builds a TickerQuoteResolutionPlan without plan-owned route state", () => {
  const yahoo = createLeafResolver("YAHOO");
  const tradingview = createLeafResolver("TRADINGVIEW-FUND", {
    sourceName: "TRADINGVIEW",
  });
  const refs = {
    resolveFxQuote() {
      throw new Error("fx quote lookup should not be requested for this test");
    },
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
    refs,
  );

  assert.equal(plan instanceof TickerQuoteResolutionPlan, true);
  assert.equal(plan.refs, refs);

  const request = {
    allowTradingviewFallback: true,
    classification: "equity",
    input: { attribute: "price", identifier: "GOOG" },
    requestType: "equity",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  };

  assert.equal(plan.describe(request), "QUOTE:TICKER -> YAHOO -> TRADINGVIEW-FUND");
  assert.equal(plan.buildRoutePath(request), "YAHOO -> TRADINGVIEW-FUND");
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
    refs,
  );

  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0], null);
});

test("buildPlanNodeFromSpec builds a StepPlan for unconditional forwarding nodes", () => {
  const defaultAttributeRoot = createLeafResolver("ATTRIBUTE");
  const identifierRoot = createLeafResolver("IDENTIFIER-ROOT");
  const refs = {
    resolveFxQuote() {
      throw new Error("fx quote lookup should not be requested for this test");
    },
  };

  const plan = buildPlanNodeFromSpec(
    "ROOT",
    {
      id: "ROOT",
      next: ["ATTRIBUTE", "IDENTIFIER-ROOT"],
      type: "StepPlan",
    },
    (nodeCode) =>
      ({
        "ATTRIBUTE": defaultAttributeRoot,
        "IDENTIFIER-ROOT": identifierRoot,
      })[nodeCode],
    null,
    refs,
  );

  assert.equal(plan instanceof StepPlan, true);
  assert.equal(plan.getRoutingNodeKind(), "step");
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
    refs,
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
    refs,
  );

  assert.equal(plan instanceof PseQuoteResolutionPlan, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.name),
    ["PSE-FRAMES", "PSE-EDGE"],
  );
});

test("ResolverPlan can resolve output-currency conversion through ResolveFlow", () => {
  const refs = {
    resolveFxQuote(request) {
      assert.equal(request.fxPair.yahooChartSymbol, "PHPUSD=X");
      return {
        route: "ATTRIBUTE:FX -> QUOTE:FX",
        status: "success",
        value: {
          currency: "USD",
          regularMarketPrice: 0.02,
        },
      };
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
    refs,
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

  const env = plan.resolveOutputCurrencyResult(request, {
    currency: "PHP",
    regularMarketPrice: 100,
  });

  assert.deepEqual(env, {
    route: "ATTRIBUTE:FX -> QUOTE:FX",
    status: "success",
    value: 0.02,
  });
});

test("ResolverPlan output-currency conversion folds stock unit scale into the FX rate", () => {
  const refs = {
    resolveFxQuote(request) {
      assert.equal(request.fxPair.yahooChartSymbol, "GBPUSD=X");
      return {
        route: "ATTRIBUTE:FX -> QUOTE:FX",
        status: "success",
        value: {
          currency: "USD",
          regularMarketPrice: 1.25,
        },
      };
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
    refs,
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
    identifier: "TSCO.L",
    infoMode: "",
    sourceOverride: "",
    ticker: "TSCO.L",
  });

  const env = plan.resolveOutputCurrencyResult(request, {
    currency: "GBP",
    fxUnitScale: 0.01,
    regularMarketPrice: 250,
    symbol: "TSCO.L",
  });

  assert.deepEqual(env, {
    route: "ATTRIBUTE:FX -> QUOTE:FX",
    status: "success",
    value: 0.0125,
  });
});
