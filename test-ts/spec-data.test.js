const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  deriveResolveFlowSpecs,
} = require("../dist/ts/core/index.js");

test("resolve flow specs are derived from DagPlan through the flow compiler", () => {
  const derived = deriveResolveFlowSpecs(DagPlan);

  assert.equal(
    derived.resolverSpecsByCode["CLASSIFY-REQUEST"],
    "RequestClassifierResolver",
  );
  assert.equal(
    derived.resolverSpecsByCode["RESOLVED-IDENTIFIER"],
    "DirectIdentifierResolver",
  );
  assert.equal(
    derived.planSpecsByCode["QUOTE:PSE"].resolverClass,
    "PseQuoteResolutionPlan",
  );
  assert.equal(
    derived.planSpecsByCode["ROOT"].resolverClass,
    "RequestClassificationPlan",
  );
});

test("deriveResolveFlowSpecs validates DAG structure before projection", () => {
  assert.throws(
    () =>
      deriveResolveFlowSpecs({
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
