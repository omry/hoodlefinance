const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConcreteResolverRegistry,
  DagPlan,
  RawRequestInput,
} = require("../dist/ts/core/index.js");
const { createRuntimePlanLookup } = require("./runtime-plan-fixtures.js");
const { createTestEnv } = require("./resolver-service-fixtures.js");

test("compiled DagPlan classifies representative examples correctly", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, createConcreteResolverRegistry(), createTestEnv());
  const rootNode = runtimeLookup.getNode("ROOT");
  const cases = [
    { example: "GOOG", expectedClassification: "equity" },
    { example: "PSE:BDO", expectedClassification: "equity" },
    { example: "EURUSD", expectedClassification: "fx" },
    { example: "USDUSD", expectedClassification: "fx" },
    { example: "US02079K1079", expectedClassification: "isin" },
    { example: "PHY077751022", expectedClassification: "isin" },
  ];

  for (const { example, expectedClassification } of cases) {
    const outcome = rootNode.execute(new RawRequestInput(example, "price"));
    assert.equal(
      outcome.status,
      "success",
      `${example}: classification succeeded`,
    );
    assert.equal(
      outcome.value.classification,
      expectedClassification,
      `${example}: classification`,
    );
  }
});
