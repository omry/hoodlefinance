const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EquityRequest,
  RequestInput,
  buildTickerJobKey,
  createAttributeRouteJob,
    createQuoteRouteJob,
    createResolvePlan,
    createResolverRouteJob,
    createRouteJob,
    getCurrentRouteNode,
    mergeRouteState,
    prepareRouteJob,
  } = require("../dist/ts/core/index.js");

function createRequestInput(init = {}) {
  return new RequestInput({
    attribute: init.attribute || "price",
    attributeRequest: {
      baseAttribute: "price",
      outputCode: "",
      rawAttribute: "price",
      wantsOutputCurrency: false,
    },
    attributeType: init.attributeType || "quote",
    classification: init.classification || "equity",
    fxPair: init.fxPair || null,
    identifier: init.identifier || "GOOG",
    infoMode: init.infoMode || "",
    sourceOverride: init.sourceOverride || "",
    ticker: init.ticker || "GOOG",
    upperTicker: (init.ticker || "GOOG").toUpperCase(),
  });
}

test("buildTickerJobKey and createQuoteRouteJob preserve the existing key contract", () => {
  assert.equal(buildTickerJobKey(" GOOG ", "PRICE"), "GOOG\nprice");

  const job = createQuoteRouteJob(" GOOG ", " PRICE ");
  assert.equal(job.key, "GOOG\nprice");
  assert.equal(job.attribute, "PRICE");
  assert.equal(job.routeKind, "quote");
  assert.equal(job.tickerInput, "GOOG");
});

test("createAttributeRouteJob and createResolverRouteJob build the expected route kinds", () => {
  const attributeJob = createAttributeRouteJob(
    "marketcap",
    { price: 10 },
    {
      tickerInput: "PSE:BDO",
    },
  );
  assert.equal(attributeJob.routeKind, "attribute");
  assert.equal(attributeJob.tickerInput, "PSE:BDO");
  assert.deepEqual(attributeJob.sourceQuote, { price: 10 });

  const identifierJob = createResolverRouteJob(
    createRequestInput({ identifier: "US02079K1079", ticker: "US02079K1079" }),
  );
  assert.equal(identifierJob.routeKind, "identifier");
  assert.equal(identifierJob.tickerInput, "US02079K1079");

  const resolvedJob = createResolverRouteJob(
    new EquityRequest({
      allowTradingviewFallback: false,
      attribute: "price",
      exchange: "NASDAQ",
      identifier: "GOOG",
      identifierResolutionMs: 0,
      symbol: "GOOG",
      yahooSymbol: "GOOG",
    }),
  );
  assert.equal(resolvedJob.routeKind, "quote");
  assert.equal(resolvedJob.tickerInput, "GOOG");
});

test("createRouteJob initializes the mutable runtime fields predictably", () => {
  const job = createRouteJob({
    attribute: "close",
    key: "A\nclose",
    routeKind: "quote",
    tickerInput: "A",
  });

  assert.equal(job.error, null);
  assert.deepEqual(job.routeNodes, []);
  assert.deepEqual(job.routeRuntimeTrace, []);
  assert.equal(job.routeLastLookupFailure, "");
  assert.equal(job.routePreferredLookupFailure, "");
  assert.equal(job.valueResolved, false);
});

test("createResolvePlan freezes the planner result shape", () => {
  const requestInput = createRequestInput();
  const plan = createResolvePlan({
    debugValue: "EQUITY -> TICKER -> YAHOO",
    plannedRoute: "EQUITY -> TICKER -> YAHOO",
    requestInput,
  });

  assert.equal(Object.isFrozen(plan), true);
  assert.equal(plan.debugValue, "EQUITY -> TICKER -> YAHOO");
  assert.equal(plan.attributePlan, null);
  assert.equal(plan.identifierPlan, null);
  assert.equal(plan.requestInput, requestInput);
});

test("getCurrentRouteNode and mergeRouteState keep runtime job state synchronized", () => {
  const node = { name: "YAHOO" };
  const plan = { nodes: [], routeClass: "", routePath: "", routeState: {} };
  const job = createRouteJob({
    plan,
    routeNodes: [node],
    routeState: { yahooSymbol: "GOOG" },
  });

  assert.equal(getCurrentRouteNode(job), node);

  mergeRouteState(job, { preferredYahooSymbol: "GOOG:ALT" });
  assert.deepEqual(job.routeState, {
    preferredYahooSymbol: "GOOG:ALT",
    yahooSymbol: "GOOG",
  });
  assert.equal(plan.routeState, job.routeState);
});

test("prepareRouteJob resets runtime routing state from the supplied plan", () => {
  const node = { name: "YAHOO" };
  const plan = {
    nodes: [node],
    routeClass: "EQUITY",
    routePath: "YAHOO",
    routeState: { yahooSymbol: "GOOG" },
  };
  const job = createRouteJob({
    routeLastLookupFailure: "old",
    routeNodes: [],
    routeState: { stale: true },
  });

  job.routeRuntimeTrace.push({ elapsedMs: 1, label: "OLD", status: "failure" });
  job.routeLastLookupFailure = "old";
  job.routePreferredLookupFailure = "preferred";

  prepareRouteJob(job, plan);

  assert.deepEqual(job.routeNodes, [node]);
  assert.deepEqual(job.routeState, { yahooSymbol: "GOOG" });
  assert.notEqual(job.routeState, plan.routeState);
  assert.deepEqual(job.routeRuntimeTrace, []);
  assert.equal(job.routeLastLookupFailure, "");
  assert.equal(job.routePreferredLookupFailure, "");
});
