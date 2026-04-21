const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderGraphAsMermaidFlowchart,
} = require("../dist/ts/core/graph-mermaid.js");

function createGraph(definition, order, subgraphs = {}) {
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
    getSubgraph(id) {
      return subgraphs[id] || null;
    },
    getSubgraphIds() {
      return Object.keys(subgraphs);
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
        type: "TerminalCollectorNode",
      },
    },
    ["ROOT", "QUOTE", "TERMINAL"],
  );

  const mermaid = renderGraphAsMermaidFlowchart(graph);

  assert.match(mermaid, /^flowchart TD/m);
  assert.match(mermaid, /N0\["ROOT<br\/>RoutingPlan"\]/);
  assert.match(mermaid, /N1\["QUOTE<br\/>YahooQuoteResolver"\]/);
  assert.match(mermaid, /N2\["TERMINAL<br\/>TerminalCollectorNode"\]/);
  assert.match(mermaid, /N0 --> N1/);
  assert.match(mermaid, /N1 --> N2/);
});

test("renderGraphAsMermaidFlowchart renders subgraph boundaries and call edges distinctly", () => {
  const graph = createGraph(
    {
      ROOT: {
        id: "ROOT",
        next: ["CALLER"],
        type: "RoutingPlan",
      },
      CALLER: {
        id: "CALLER",
        next: ["TERMINAL"],
        subgraphCalls: ["FX"],
        type: "NormalizePricePlan",
      },
      "FX:START": {
        group: "FX",
        id: "FX:START",
        next: ["FX:END"],
        type: "FxAttributeResolutionPlan",
      },
      "FX:END": {
        group: "FX",
        id: "FX:END",
        next: ["TERMINAL"],
        type: "FxAttributeExtractResolver",
      },
      TERMINAL: {
        id: "TERMINAL",
        type: "TerminalCollectorNode",
      },
    },
    ["ROOT", "CALLER", "FX:START", "FX:END", "TERMINAL"],
    {
      FX: {
        rootNodeId: "FX:START",
        terminalNodeId: "FX:END",
      },
    },
  );

  const mermaid = renderGraphAsMermaidFlowchart(graph);

  assert.match(mermaid, /ROOT<br\/>FX:START<br\/>FxAttributeResolutionPlan/);
  assert.match(mermaid, /TERMINAL<br\/>FX:END<br\/>FxAttributeExtractResolver/);
  assert.match(mermaid, /\. "call FX" \.->/);
});
