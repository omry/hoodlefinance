const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConcreteResolverRegistry,
  DagPlan,
  Flow,
} = require("../dist/ts/core/index.js");
const { createTestEnv } = require("./resolver-service-fixtures.js");

test("DagPlan uses the final graph node shape", () => {
  assert.equal(DagPlan.ROOT.id, "ROOT");
  assert.equal(DagPlan.ROOT.type, "RequestClassifierResolver");
  assert.deepEqual(DagPlan.ROOT.next, ["ATTRIBUTE", "IDENTIFIER:ISIN"]);
  assert.equal(DagPlan["QUOTE:PSE"].type, "PseQuoteResolutionPlan");
  assert.deepEqual(DagPlan["QUOTE:PSE"].next, ["PSE-FRAMES", "PSE-EDGE"]);
  assert.deepEqual(DagPlan["EXTRACT:EQUITY"].subgraphCalls, ["FX_CONVERSION"]);
  assert.equal(DagPlan["EXTRACT:FX"].subgraphCalls, undefined);
  assert.deepEqual(DagPlan.__subgraphs__, {
    FX_CONVERSION: {
      rootNodeId: "ATTRIBUTE:FX",
      terminalNodeId: "EXTRACT:FX",
    },
  });
});

test("Flow builds and validates DagPlan directly from the authored graph", () => {
  const flow = new Flow(
    DagPlan,
    createConcreteResolverRegistry(),
    createTestEnv(),
  );

  assert.equal(flow.getGraph().getRoot().id, "ROOT");
  assert.equal(flow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(
    flow.getGraph().getNode("QUOTE:PSE").type,
    "PseQuoteResolutionPlan",
  );
});

test("Flow validates DAG structure during construction", () => {
  assert.throws(() => {
    new Flow(
      {
        ROOT: {
          id: "ROOT",
          next: ["MISSING"],
          type: "RoutingPlan",
        },
        TERMINAL: {
          id: "TERMINAL",
          type: "TerminalCollectorPlan",
        },
      },
      createConcreteResolverRegistry(),
      createTestEnv(),
    );
  }, /missing child "MISSING"/i);
});
