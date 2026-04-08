const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  deriveDagPlanLegacyExecutionSpecs,
} = require("../dist/ts/core/index.js");

test("legacy execution specs are derived from DagPlan only through the legacy adapter", () => {
  const derived = deriveDagPlanLegacyExecutionSpecs(DagPlan);

  assert.equal(
    derived.resolverSpecsByCode["RESOLVED-IDENTIFIER"],
    "DirectIdentifierResolver",
  );
  assert.equal(
    derived.planSpecsByCode["QUOTE:PSE"].resolverClass,
    "PseQuoteResolutionPlan",
  );
  assert.equal(derived.planSpecsByCode["ROOT"].resolverClass, "RoutingPlan");
});

test("deriveDagPlanLegacyExecutionSpecs validates DAG structure before projection", () => {
  assert.throws(
    () =>
      deriveDagPlanLegacyExecutionSpecs({
        ROOT: {
          resolverClass: "RoutingPlan",
          nodeCodes: ["MISSING"],
        },
        TERMINAL: {
          resolverClass: "TerminalCollectorPlan",
        },
      }),
    /missing child "MISSING"/i,
  );
});
