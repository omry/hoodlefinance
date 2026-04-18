const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createResolutionFailure,
  createResolutionSuccess,
  createRouteResult,
  defaultRouteFailureMessage,
  describePlanSource,
  formatRouteFailureMessage,
} = require("../dist/ts/core/index.js");

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

  assert.equal(defaultRouteFailureMessage(), "Quote lookup failed.");
  assert.equal(
    formatRouteFailureMessage(job, "Market data unavailable."),
    "Market data unavailable. Failed nodes: YAHOO, PSE.",
  );
});

test("createRouteResult preserves the open-ended route adapter payload shape", () => {
  assert.deepEqual(createRouteResult("success", { quote: { price: 10 } }), {
    quote: { price: 10 },
    status: "success",
  });
});

