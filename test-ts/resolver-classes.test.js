const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FirstSuccessJunction,
  RawRequestInput,
  RequestInput,
  PseQuoteResolutionPlan,
  FlowNode,
  FlowJunction,
  BaseHFResolver,
  StepJunction,
  SwitchJunction,
  TickerQuoteResolutionPlan,
  buildPlanNodeFromSpec,
  createResolutionFailure,
  createResolutionSuccess,
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
  class LeafResolver extends BaseHFResolver {
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


test("FlowNode constructor uses the graph node id", () => {
  const resolver = new FlowNode("ROOT");

  assert.equal(resolver.id, "ROOT");
  assert.equal(resolver.id, "ROOT");
});

test("FlowJunction maintains standard fallback sequence and full routing-tree visibility", () => {
  const yahoo = createLeafResolver("YAHOO");
  const ibkr = createLeafResolver("IBKR");

  const plan = new FlowJunction("QUOTE", [yahoo, ibkr]);

  const request = createRequestInput();

  assert.deepEqual(
    plan.getHandleableNodes(request).map((node) => node.id),
    ["YAHOO", "IBKR"],
  );
});

test("StepPlan forwards to all children without request-based selection", () => {
  const first = createLeafResolver("FIRST", {
    canHandle() {
      return false;
    },
  });
  const second = createLeafResolver("SECOND");
  const plan = new StepJunction("ROOT", [first, second]);

  assert.deepEqual(
    plan
      .getHandleableNodes(new RawRequestInput("GOOG", "price"))
      .map((node) => node.id),
    ["FIRST", "SECOND"],
  );
  assert.deepEqual(
    plan.getHandleableNodes(createRequestInput()).map((node) => node.id),
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
  const plan = new SwitchJunction("QUOTE", [ibkr, yahoo]);
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
  const plan = new FirstSuccessJunction("QUOTE", [skipped, yahoo, ibkr]);
  const context = {};
  const request = createRequestInput();

  assert.deepEqual(plan.selectNext(request, context), [yahoo]);
  assert.deepEqual(plan.selectNext(request, context), [ibkr]);
  assert.deepEqual(plan.selectNext(request, context), []);
});

test("StepPlan selectNext returns all children and rejects unhandleable output", () => {
  const first = createLeafResolver("FIRST");
  const second = createLeafResolver("SECOND");
  const plan = new StepJunction("ROOT", [first, second]);
  const request = createRequestInput();

  assert.deepEqual(plan.selectNext(request, {}), [first, second]);

  const failingPlan = new StepJunction("ROOT", [
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
  );

  assert.equal(plan instanceof TickerQuoteResolutionPlan, true);

  const request = {
    allowTradingviewFallback: true,
    classification: "equity",
    input: { attribute: "price", identifier: "GOOG" },
    requestType: "equity",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  };

});

test("buildPlanNodeFromSpec preserves unresolved child slots like the runtime materializer", () => {
  const plan = buildPlanNodeFromSpec(
    "ROOT",
    {
      id: "ROOT",
      next: ["MISSING"],
      type: "RoutingPlan",
    },
    () => null,
  );

  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0], null);
});

test("buildPlanNodeFromSpec builds a StepPlan for unconditional forwarding nodes", () => {
  const defaultAttributeRoot = createLeafResolver("ATTRIBUTE");
  const identifierRoot = createLeafResolver("IDENTIFIER-ROOT");

  const plan = buildPlanNodeFromSpec(
    "ROOT",
    {
      id: "ROOT",
      next: ["ATTRIBUTE", "IDENTIFIER-ROOT"],
      type: "StepPlan",
    },
    (nodeCode) =>
      ({
        ATTRIBUTE: defaultAttributeRoot,
        "IDENTIFIER-ROOT": identifierRoot,
      })[nodeCode],
  );

  assert.equal(plan instanceof StepJunction, true);
  assert.equal(plan.getNodeKind(), "step");
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
  );

  assert.equal(plan instanceof FirstSuccessJunction, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.id),
    ["ISIN:PSE", "ISIN:YAHOO"],
  );
  assert.deepEqual(
    plan
      .getHandleableNodes(createRequestInput({ ticker: "PHY077751022" }))
      .map((node) => node.id),
    ["ISIN:PSE", "ISIN:YAHOO"],
  );
  assert.deepEqual(
    plan
      .getHandleableNodes(createRequestInput({ ticker: "US02079K1079" }))
      .map((node) => node.id),
    ["ISIN:YAHOO"],
  );
});

test("PseQuoteResolutionPlan materializes as the dedicated PSE quote plan", () => {
  const pseFrames = createLeafResolver("PSE-FRAMES");
  const pseEdge = createLeafResolver("PSE-EDGE");
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
  );

  assert.equal(plan instanceof PseQuoteResolutionPlan, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.id),
    ["PSE-FRAMES", "PSE-EDGE"],
  );
});


test("resolution result helpers normalize elapsed time and error formatting", () => {
  assert.deepEqual(createResolutionSuccess("ok", -2), {
    elapsedMs: 0,
    status: "success",
    value: "ok",
  });

  assert.deepEqual(
    createResolutionFailure(new Error("broken"), -1, (error) =>
      error instanceof Error ? error.message : String(error),
    ),
    {
      elapsedMs: 0,
      error: "broken",
      status: "failure",
    },
  );
});
