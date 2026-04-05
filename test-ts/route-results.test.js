const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyRouteResult,
  collectFailedRouteLabels,
  createDebugRoutePlan,
  createResolutionFailure,
  createResolutionSuccess,
  createRouteResult,
  defaultRouteFailureMessage,
  describePlanSource,
  formatRouteFailureMessage,
  isDebugRoutePlan,
  shouldPreferLookupFailureMessage,
} = require("../dist/ts/core/index.js");

test("debug-route helpers preserve the current debug plan contract", () => {
  const plan = createDebugRoutePlan("FX -> GOOGLE");

  assert.equal(isDebugRoutePlan(plan), true);
  assert.equal(describePlanSource(plan), "FX -> GOOGLE");
  assert.equal(describePlanSource(null), "");
});

test("describePlanSource handles normal and forced route labels", () => {
  assert.equal(
    describePlanSource({ routeClass: "EQUITY -> TICKER", routePath: "YAHOO" }),
    "EQUITY -> TICKER -> YAHOO",
  );
  assert.equal(
    describePlanSource({ routeClass: "FORCED:YAHOO", routePath: "YAHOO" }),
    "YAHOO",
  );
  assert.equal(describePlanSource({ routeClass: "", routePath: "PSE" }), "PSE");
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

test("route failure helpers preserve trace-based label reporting", () => {
  const job = {
    routeKind: "quote",
    routeRuntimeTrace: [
      { elapsedMs: 5, label: "YAHOO", status: "lookup_failure" },
      { elapsedMs: 3, label: "YAHOO", status: "terminal_error" },
      { elapsedMs: 4, label: "TRADINGVIEW", status: "success" },
      { elapsedMs: 2, label: "PSE", status: "terminal_error" },
    ],
  };

  assert.deepEqual(collectFailedRouteLabels(job), ["YAHOO", "PSE"]);
  assert.equal(defaultRouteFailureMessage(job), "Quote lookup failed.");
  assert.equal(
    formatRouteFailureMessage(job, "Market data unavailable."),
    "Market data unavailable. Failed nodes: YAHOO, PSE.",
  );
  assert.equal(
    defaultRouteFailureMessage({ routeKind: "isin", routeRuntimeTrace: [] }),
    "ISIN lookup failed.",
  );
});

test("createRouteResult preserves the open-ended route adapter payload shape", () => {
  assert.deepEqual(createRouteResult("success", { quote: { price: 10 } }), {
    quote: { price: 10 },
    status: "success",
  });
});

test("applyRouteResult updates job state for success, lookup failure, and terminal failure", () => {
  const makeJob = () => ({
    error: null,
    plan: { nodes: [], routeClass: "", routePath: "", routeState: {} },
    quote: null,
    routeKind: "quote",
    routeLastLookupFailure: "",
    routeNodes: [{ name: "YAHOO", traceLabel: "YAHOO" }, { name: "IBKR" }],
    routePreferredLookupFailure: "",
    routeRuntimeTrace: [],
    routeState: {},
    value: null,
    valueResolved: false,
  });

  const successJob = makeJob();
  applyRouteResult(
    successJob,
    successJob.routeNodes[0],
    { quote: { price: 10 }, status: "success" },
    7,
    (error) => String(error),
  );
  assert.deepEqual(successJob.quote, { price: 10 });
  assert.equal(successJob.routeRuntimeTrace[0].label, "YAHOO");

  const lookupFailureJob = makeJob();
  applyRouteResult(
    lookupFailureJob,
    lookupFailureJob.routeNodes[0],
    { error: "Service currently unavailable", status: "lookup_failure" },
    2,
    (error) => String(error),
  );
  assert.equal(lookupFailureJob.routeNodes.length, 1);
  assert.equal(
    lookupFailureJob.routePreferredLookupFailure,
    "Service currently unavailable",
  );
  assert.equal(lookupFailureJob.error, null);

  applyRouteResult(
    lookupFailureJob,
    lookupFailureJob.routeNodes[0],
    { error: "Second lookup failed", status: "lookup_failure" },
    3,
    (error) => String(error),
  );
  assert.match(lookupFailureJob.error, /Failed nodes:/);

  const terminalJob = makeJob();
  applyRouteResult(
    terminalJob,
    terminalJob.routeNodes[0],
    { error: "Boom", status: "terminal_error" },
    1,
    (error) => String(error),
  );
  assert.equal(terminalJob.error, "Boom Failed nodes: YAHOO.");
});

test("shouldPreferLookupFailureMessage keeps the current availability heuristic", () => {
  assert.equal(
    shouldPreferLookupFailureMessage("Service currently unavailable"),
    true,
  );
  assert.equal(shouldPreferLookupFailureMessage("Bad ticker"), false);
});
