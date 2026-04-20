const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RawRequestInput,
  ROUTING_TABLE_EXAMPLES,
  buildRoutingPlanTreeNode,
  buildRoutingTableGrid,
  buildRoutingTableRow,
  formatRoutingPlanTreeLabel,
  getRoutingTableRows,
} = require("../dist/ts/core/index.js");

function createDeps() {
  return {
    classifyRequest(requestInput) {
      const identifier = requestInput.identifier;
      return {
        classification:
          identifier === "EURUSD" || identifier === "USDUSD"
            ? "fx"
            : identifier === "US02079K1079" || identifier === "PHY077751022"
              ? "isin"
              : "equity",
      };
    },
  };
}

test("routing table helpers preserve the example-driven introspection shape", () => {
  const deps = createDeps();

  assert.equal(Array.isArray(ROUTING_TABLE_EXAMPLES), true);
  assert.equal(ROUTING_TABLE_EXAMPLES.length, 7);

  assert.deepEqual(buildRoutingTableRow({ example: "GOOG" }, deps), {
    classification: "equity",
    example: "GOOG",
  });

  assert.equal(getRoutingTableRows(deps).length, ROUTING_TABLE_EXAMPLES.length);
  assert.deepEqual(buildRoutingTableGrid(deps)[0], [
    "classification",
    "example",
  ]);
});

test("routing tree helpers format labels and recurse plan children", () => {
  const yahooNode = {
    getRoutingNodeKind() {
      return "leaf";
    },
    name: "YAHOO",
  };
  const rootNode = {
    getRoutingNodes() {
      return [yahooNode];
    },
    getRoutingNodeKind() {
      return "switch";
    },
    name: "ROOT",
  };

  assert.equal(
    formatRoutingPlanTreeLabel(" default attribute "),
    "DEFAULT ATTRIBUTE",
  );
  assert.deepEqual(buildRoutingPlanTreeNode(rootNode), {
    children: [
      {
        children: [],
        kind: "leaf",
        label: "YAHOO",
      },
    ],
    kind: "switch",
    label: "ROOT",
  });
});

test("routing tree uses explicit node kinds from the resolver", () => {
  const selectorNode = {
    getRoutingNodes() {
      return [];
    },
    getRoutingNodeKind() {
      return "switch";
    },
    name: "IDENTIFIER:ISIN",
    routingLabel: "",
  };

  assert.deepEqual(buildRoutingPlanTreeNode(selectorNode), {
    children: [],
    kind: "switch",
    label: "IDENTIFIER:ISIN",
  });
});
