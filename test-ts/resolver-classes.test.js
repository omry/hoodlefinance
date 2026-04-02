const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AttemptResolver,
  AttributeResolutionPlan,
  RequestInput,
  ResolverPlan,
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
  class LeafResolver extends AttemptResolver {
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

test("ResolverPlan keeps selector-aware runtime behavior and full routing-tree visibility", () => {
  const yahoo = createLeafResolver("YAHOO");
  const ibkr = createLeafResolver("IBKR");
  const selector = (nodes) => [nodes[1]];
  selector.requestDependent = true;

  const plan = new ResolverPlan("QUOTE", [yahoo, ibkr], {
    isRoutingNode: false,
    nodeSelector: selector,
    routePath: "",
  });

  const request = createRequestInput();

  assert.deepEqual(
    plan.getNodesForRequest(request).map((node) => node.name),
    ["IBKR"],
  );
  assert.deepEqual(
    plan.getRoutingNodes().map((node) => node.name),
    ["YAHOO", "IBKR"],
  );
  assert.equal(plan.buildRoutePath(request), "IBKR");
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
    {
      extractIsinCountryCode() {
        return "";
      },
      refs,
    },
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

  assert.equal(runtimePlan.routeClass, "EQUITY -> TICKER");
  assert.equal(runtimePlan.routePath, "YAHOO -> TRADINGVIEW");
  assert.deepEqual(runtimePlan.routeState, {
    fxPair: null,
    preferredYahooSymbol: "GOOG:ALT",
    yahooSymbol: "GOOG",
  });
});
