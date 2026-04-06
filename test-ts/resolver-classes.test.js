const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AttributeResolutionPlan,
  IdentifierResolutionPlan,
  RequestInput,
  PseQuoteResolutionPlan,
  ResolverPlan,
  RouteExecutionResolver,
  buildPlanNodeFromSpec,
  createPlanRuntimeRefs,
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

test("buildPlanNodeFromSpec materializes route refs into a real plan instance", () => {
  const yahoo = createLeafResolver("YAHOO");
  const tradingview = createLeafResolver("TRADINGVIEW-FUND", {
    sourceName: "TRADINGVIEW",
  });
  const refs = createPlanRuntimeRefs({
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    resolvePreferredYahooSymbol(symbol) {
      return `${symbol}:ALT`;
    },
  });

  const plan = buildPlanNodeFromSpec(
    "QUOTE:TICKER",
    {
      nodeCodes: ["YAHOO", "TRADINGVIEW-FUND"],
      options: {
        routeClassRef: "EQUITY_TICKER_CLASS",
        routePathRef: "EQUITY_TICKER_PATH",
        routeStateBuilderRef: "EQUITY_YAHOO_QUOTE",
      },
      resolverClass: "AttributeResolutionPlan",
    },
    (nodeCode) =>
      ({
        "TRADINGVIEW-FUND": tradingview,
        YAHOO: yahoo,
      })[nodeCode],
    null,
    { refs },
  );

  assert.equal(plan instanceof AttributeResolutionPlan, true);

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
  assert.deepEqual(runtimePlan.routeState, {
    fxPair: null,
    preferredYahooSymbol: "GOOG:ALT",
    yahooSymbol: "GOOG",
  });
});

test("buildPlanNodeFromSpec preserves unresolved child slots like the runtime materializer", () => {
  const refs = createPlanRuntimeRefs({
    looksLikeIsin() {
      return false;
    },
    resolvePreferredYahooSymbol(symbol) {
      return symbol;
    },
  });

  const plan = buildPlanNodeFromSpec(
    "ROOT",
    {
      nodeCodes: ["MISSING"],
      resolverClass: "ResolverPlan",
    },
    () => null,
    null,
    { refs },
  );

  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0], null);
});

test("IdentifierResolutionPlan owns ISIN-country selection behavior", () => {
  const pseMap = createLeafResolver("PSE-MAP");
  const yahooIsin = createLeafResolver("YAHOO-ISIN");
  const refs = createPlanRuntimeRefs({
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    resolvePreferredYahooSymbol(symbol) {
      return symbol;
    },
  });

  const plan = buildPlanNodeFromSpec(
    "IDENTIFIER:ISIN",
    {
      nodeCodeByIsinCountry: {
        PH: "PSE-MAP",
        _default_: "YAHOO-ISIN",
      },
      resolverClass: "IdentifierResolutionPlan",
    },
    (nodeCode) =>
      ({
        "PSE-MAP": pseMap,
        "YAHOO-ISIN": yahooIsin,
      })[nodeCode],
    null,
    { refs },
  );

  assert.equal(plan instanceof IdentifierResolutionPlan, true);
  assert.deepEqual(
    plan.nodes.map((node) => node && node.name),
    ["PSE-MAP", "YAHOO-ISIN"],
  );
  assert.deepEqual(plan.nodeCodeByIsinCountry, { PH: "PSE-MAP", _default_: "YAHOO-ISIN" });
  assert.deepEqual(plan.defaultLookupNodeCodes, ["YAHOO-ISIN"]);
  assert.deepEqual(
    plan.getNodesForRequest(createRequestInput({ ticker: "PHY077751022" })).map(
      (node) => node.name,
    ),
    ["PSE-MAP", "YAHOO-ISIN"],
  );
  assert.deepEqual(
    plan.getNodesForRequest(createRequestInput({ ticker: "US02079K1079" })).map(
      (node) => node.name,
    ),
    ["YAHOO-ISIN"],
  );
});

test("PseQuoteResolutionPlan materializes as the dedicated PSE quote plan", () => {
  const pseFrames = createLeafResolver("PSE-FRAMES");
  const pseEdge = createLeafResolver("PSE-EDGE");
  const refs = createPlanRuntimeRefs({
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    resolvePreferredYahooSymbol(symbol) {
      return symbol;
    },
  });

  const plan = buildPlanNodeFromSpec(
    "QUOTE:PSE",
    {
      nodeCodes: ["PSE-FRAMES", "PSE-EDGE"],
      resolverClass: "PseQuoteResolutionPlan",
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
