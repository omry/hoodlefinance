const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  instantiateHoodleFinancePlanSpecDag,
  hoodleFinanceDagStructureValidation,
  instantiatePlanSpecDag,
} = require("../dist/ts/core/index.js");

function createValidDagSpecs() {
  return {
    " root ": {
      resolverClass: "RoutingPlan",
      nodeCodes: [" quote ", "identifier "],
    },
    QUOTE: {
      resolverClass: "RoutingPlan",
      nodeCodes: ["TERMINAL"],
    },
    IDENTIFIER: {
      resolverClass: "FirstSuccessPlan",
      nodeCodes: [" country-leaf ", "terminal"],
    },
    " country-leaf ": {
      resolverClass: "LeafResolver",
      nodeCodes: ["TERMINAL"],
    },
    TERMINAL: {
      resolverClass: "TerminalCollectorPlan",
    },
  };
}

function edgeLabels(dag) {
  return dag.edges
    .map(({ childCode, parentCode }) => `${parentCode}->${childCode}`)
    .sort();
}

test("instantiatePlanSpecDag", async (t) => {
  await t.test(
    "builds a structural DAG from normalized ordered child codes",
    () => {
      const dag = instantiateHoodleFinancePlanSpecDag(createValidDagSpecs());

      assert.equal(dag.root.code, "ROOT");
      assert.equal(dag.terminal.code, "TERMINAL");
      assert.deepEqual(
        dag.nodes.map((node) => node.code),
        ["ROOT", "QUOTE", "IDENTIFIER", "COUNTRY-LEAF", "TERMINAL"],
      );
      assert.deepEqual(dag.nodesByCode.ROOT.childCodes, [
        "QUOTE",
        "IDENTIFIER",
      ]);
      assert.deepEqual(dag.nodesByCode.IDENTIFIER.childCodes, [
        "COUNTRY-LEAF",
        "TERMINAL",
      ]);
      assert.deepEqual(dag.nodesByCode["COUNTRY-LEAF"].parentCodes, [
        "IDENTIFIER",
      ]);
      assert.deepEqual(edgeLabels(dag), [
        "COUNTRY-LEAF->TERMINAL",
        "IDENTIFIER->COUNTRY-LEAF",
        "IDENTIFIER->TERMINAL",
        "QUOTE->TERMINAL",
        "ROOT->IDENTIFIER",
        "ROOT->QUOTE",
      ]);
      assert.equal(dag.topologicalOrder[0].code, "ROOT");
      assert.equal(
        dag.topologicalOrder[dag.topologicalOrder.length - 1].code,
        "TERMINAL",
      );
    },
  );

  await t.test("instantiates DagPlan as a valid HOODLEFINANCE DAG", () => {
    const dag = instantiateHoodleFinancePlanSpecDag(DagPlan);

    assert.equal(dag.root.code, "ROOT");
    assert.equal(dag.terminal.code, "TERMINAL");
    assert.ok(dag.nodesByCode.YAHOO);
    assert.ok(dag.nodesByCode["RESOLVED-IDENTIFIER"]);
    assert.ok(edgeLabels(dag).includes("YAHOO->TERMINAL"));
    assert.ok(edgeLabels(dag).includes("IDENTIFIER:ISIN->ISIN:PSE"));
    assert.ok(edgeLabels(dag).includes("IDENTIFIER:ISIN->ISIN:YAHOO"));
  });

  await t.test("uses ordered child codes for identifier fallback subgraphs", () => {
    const dag = instantiateHoodleFinancePlanSpecDag({
      ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["IDENTIFIER"] },
      IDENTIFIER: {
        resolverClass: "FirstSuccessPlan",
        nodeCodes: ["ISIN:PSE", "ISIN:YAHOO"],
      },
      "ISIN:PSE": { resolverClass: "LeafResolver", nodeCodes: ["TERMINAL"] },
      "ISIN:YAHOO": {
        resolverClass: "LeafResolver",
        nodeCodes: ["TERMINAL"],
      },
      TERMINAL: { resolverClass: "TerminalCollectorPlan" },
    });

    assert.deepEqual(dag.nodesByCode.IDENTIFIER.childCodes, [
      "ISIN:PSE",
      "ISIN:YAHOO",
    ]);
  });

  await t.test(
    "instantiateHoodleFinancePlanSpecDag combines instantiation and validation",
    () => {
      assert.throws(
        () =>
          instantiateHoodleFinancePlanSpecDag({
            ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
            ORPHAN: {
              resolverClass: "RoutingPlan",
              nodeCodes: ["TERMINAL"],
            },
            TERMINAL: { resolverClass: "TerminalCollectorPlan" },
          }),
        /exactly one root; found 2/i,
      );
    },
  );

  await t.test("rejects duplicate normalized codes", () => {
    assert.throws(
      () =>
        instantiatePlanSpecDag({
          ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
          " root ": { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
          TERMINAL: { resolverClass: "TerminalCollectorPlan" },
        }),
      /duplicate normalized code "ROOT"/i,
    );
  });

  await t.test("rejects missing referenced child nodes", () => {
    assert.throws(
      () =>
        instantiatePlanSpecDag({
          ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["MISSING"] },
        }),
      /references missing child "MISSING"/i,
    );
  });

  await t.test("rejects cycles", () => {
    assert.throws(
      () =>
        instantiatePlanSpecDag({
          ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["A"] },
          A: { resolverClass: "RoutingPlan", nodeCodes: ["ROOT"] },
        }),
      /contains a cycle/i,
    );
  });

  await t.test("allows multiple roots in the generic structural DAG", () => {
    const dag = instantiatePlanSpecDag({
      ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
      ORPHAN: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
      TERMINAL: { resolverClass: "TerminalCollectorPlan" },
    });

    assert.deepEqual(
      dag.nodes
        .filter((node) => node.parentCodes.length === 0)
        .map((node) => node.code)
        .sort(),
      ["ORPHAN", "ROOT"],
    );
  });

  await t.test("allows multiple terminal nodes in the generic structural DAG", () => {
    const dag = instantiatePlanSpecDag({
      ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["LEFT", "RIGHT"] },
      LEFT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL-A"] },
      RIGHT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL-B"] },
      "TERMINAL-A": { resolverClass: "TerminalCollectorPlan" },
      "TERMINAL-B": { resolverClass: "TerminalCollectorPlan" },
    });

    assert.deepEqual(
      dag.nodes
        .filter((node) => node.childCodes.length === 0)
        .map((node) => node.code)
        .sort(),
      ["TERMINAL-A", "TERMINAL-B"],
    );
  });

  await t.test("hoodleFinanceDagStructureValidation rejects multiple roots", () => {
    assert.throws(
      () =>
        hoodleFinanceDagStructureValidation(
          instantiatePlanSpecDag({
            ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
            ORPHAN: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
            TERMINAL: { resolverClass: "TerminalCollectorPlan" },
          }),
        ),
      /exactly one root; found 2/i,
    );
  });

  await t.test(
    "hoodleFinanceDagStructureValidation rejects multiple terminal nodes",
    () => {
      assert.throws(
        () =>
          hoodleFinanceDagStructureValidation(
            instantiatePlanSpecDag({
              ROOT: {
                resolverClass: "RoutingPlan",
                nodeCodes: ["LEFT", "RIGHT"],
              },
              LEFT: {
                resolverClass: "RoutingPlan",
                nodeCodes: ["TERMINAL-A"],
              },
              RIGHT: {
                resolverClass: "RoutingPlan",
                nodeCodes: ["TERMINAL-B"],
              },
              "TERMINAL-A": { resolverClass: "TerminalCollectorPlan" },
              "TERMINAL-B": { resolverClass: "TerminalCollectorPlan" },
            }),
          ),
        /exactly one terminal; found 2/i,
      );
    },
  );

  await t.test("hoodleFinanceDagStructureValidation rejects disconnected components", () => {
    assert.throws(
      () =>
        hoodleFinanceDagStructureValidation(
          instantiatePlanSpecDag({
            ROOT: { resolverClass: "RoutingPlan", nodeCodes: ["TERMINAL"] },
            DISCONNECTED: {
              resolverClass: "RoutingPlan",
              nodeCodes: ["TERMINAL"],
            },
            TERMINAL: { resolverClass: "TerminalCollectorPlan" },
          }),
        ),
      /exactly one root; found 2/i,
    );
  });
});
