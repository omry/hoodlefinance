const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderGraphAsMermaidFlowchart,
} = require("../dist/ts/core/graph-mermaid.js");

function createGraph(definition, order) {
  const normalizedOrder = order.map((id) => definition[id]);

  return {
    definition,
    getChildren(id) {
      const node = definition[id] || null;

      return (node && node.next ? node.next : []).map(
        (childId) => definition[childId],
      );
    },
    getNode(id) {
      return definition[id] || null;
    },
    getParents(id) {
      return normalizedOrder.filter((node) => (node.next || []).includes(id));
    },
    getRoot() {
      return definition.ROOT || null;
    },
    getTerminal() {
      return definition.TERMINAL || null;
    },
    getTopologicalOrder() {
      return normalizedOrder.slice();
    },
  };
}

test("renderGraphAsMermaidFlowchart renders ordered nodes and edges from Graph.View", () => {
  const graph = createGraph(
    {
      ROOT: {
        id: "ROOT",
        next: ["QUOTE"],
        type: "RoutingPlan",
      },
      QUOTE: {
        id: "QUOTE",
        next: ["TERMINAL"],
        type: "YahooQuoteResolver",
      },
      TERMINAL: {
        id: "TERMINAL",
        type: "TerminalCollectorPlan",
      },
    },
    ["ROOT", "QUOTE", "TERMINAL"],
  );

  const mermaid = renderGraphAsMermaidFlowchart(graph);

  assert.match(mermaid, /^flowchart TD/m);
  assert.match(mermaid, /N0\["ROOT"\]/);
  assert.match(mermaid, /N1\["QUOTE"\]/);
  assert.match(mermaid, /N0 --> N1/);
  assert.match(mermaid, /N1 --> N2/);
});
