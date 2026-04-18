const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createResolutionFailure,
  createResolutionSuccess,
  describePlanSource,
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

