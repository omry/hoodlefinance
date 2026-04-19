const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConcreteResolverRegistry,
  DagPlan,
  ResolveFlow,
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

test("ResolveFlow builds and validates DagPlan directly from the authored graph", () => {
  const resolveFlow = new ResolveFlow(
    DagPlan,
    createConcreteResolverRegistry(),
    createTestEnv(),
  );

  assert.equal(resolveFlow.getGraph().getRoot().id, "ROOT");
  assert.equal(resolveFlow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(
    resolveFlow.getGraph().getNode("QUOTE:PSE").type,
    "PseQuoteResolutionPlan",
  );
});

test("ResolveFlow validates DAG structure during construction", () => {
  assert.throws(() => {
    new ResolveFlow(
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
