const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestInput,
  ROUTING_TABLE_EXAMPLES,
  buildRoutingPlanTreeNode,
  buildRoutingTableGrid,
  buildRoutingTableRow,
  createDebugRoutePlan,
  formatRoutingPlanTreeLabel,
  getRoutingTableRows,
} = require("../dist/ts/core/index.js");

function createRequestInput(identifier, attribute) {
  return new RequestInput({
    attribute,
    attributeRequest: {
      baseAttribute: "price",
      outputCode: "",
      rawAttribute: attribute,
      wantsOutputCurrency: false,
    },
    attributeType: "quote",
    classification:
      identifier === "EURUSD" || identifier === "USDUSD"
        ? "fx"
        : identifier === "US02079K1079"
          ? "isin"
          : "equity",
    fxPair: null,
    identifier,
    infoMode: "",
    sourceOverride: "",
    ticker: identifier,
    upperTicker: identifier.toUpperCase(),
  });
}

function createDeps() {
  return {
    buildResolvePlan(requestInput) {
      return {
        debugValue: "",
        plannedRoute: `ROUTE:${requestInput.ticker}`,
      };
    },
    createRequestInput,
  };
}

test("routing table helpers preserve the example-driven introspection shape", () => {
  const deps = createDeps();

  assert.equal(Array.isArray(ROUTING_TABLE_EXAMPLES), true);
  assert.equal(ROUTING_TABLE_EXAMPLES.length, 6);

  assert.deepEqual(buildRoutingTableRow({ example: "GOOG" }, deps), {
    classification: "equity",
    example: "GOOG",
    route: "ROUTE:GOOG",
  });

  assert.equal(getRoutingTableRows(deps).length, ROUTING_TABLE_EXAMPLES.length);
  assert.deepEqual(buildRoutingTableGrid(deps)[0], [
    "classification",
    "example",
    "planned route",
  ]);
});

test("routing tree helpers format labels and recurse plan children", () => {
  const yahooNode = {
    describeRoutingNode() {
      return "YAHOO - Yahoo quote lookup";
    },
    name: "YAHOO",
  };
  const rootNode = {
    getRoutingNodes() {
      return [yahooNode];
    },
    name: "ROOT",
    routingLabel: "root",
  };

  assert.equal(
    formatRoutingPlanTreeLabel(" default attribute "),
    "DEFAULT ATTRIBUTE",
  );
  assert.deepEqual(buildRoutingPlanTreeNode(rootNode), {
    children: [
      {
        children: [],
        label: "YAHOO - Yahoo quote lookup",
      },
    ],
    label: "ROOT",
  });
});

test("createDebugRoutePlan keeps the debug route payload simple", () => {
  assert.deepEqual(createDebugRoutePlan("FX -> GOOGLE"), {
    debugValue: "FX -> GOOGLE",
  });
});
