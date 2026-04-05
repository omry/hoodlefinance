/* SPDX-License-Identifier: MPL-2.0 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildRoutingGraph } from "../dist/ts/core/routing-graph-builder.js";
import {
  InputNode,
  SymbolFastForwardNode,
  YahooIsinSearchNode,
  PseIsinMapNode,
  FirstSuccessNode,
  AttributeExtractionNode,
  LocalFxNode,
} from "../dist/ts/core/routing-nodes.js";

// Mock resolver
class MockResolver {
  constructor(name) {
    this.name = name;
    this.code = name;
  }

  canHandle() {
    return true;
  }

  buildRuntimePlan() {
    return { nodes: [], routeClass: "mock", routePath: "mock", routeState: {} };
  }

  executeBatch() {
    return [];
  }

  describe() {
    return this.name;
  }

  getRoutingNodeKind() {
    return "leaf";
  }

  get routingDescription() {
    return this.name;
  }

  get routingLabel() {
    return this.name;
  }

  get sourceName() {
    return this.name;
  }
}

const mockDeps = {
  directIdentifierResolver: new MockResolver("direct"),
  yahooIsinSearchResolver: new MockResolver("yahoo-isin"),
  pseIsinMapResolver: new MockResolver("pse-isin"),
  localFxResolver: new MockResolver("local-fx"),
  googleFxResolver: new MockResolver("google-fx"),
  yahooQuoteResolver: new MockResolver("yahoo-quote"),
  pseEdgeResolver: new MockResolver("pse-edge"),
  pseFramesResolver: new MockResolver("pse-frames"),
  tradingviewFundResolver: new MockResolver("tradingview-fund"),
};

test("routing-graph-builder", async (t) => {
  await t.test("builds equity graph with symbol fast-forward and quote fallback", () => {
    const input = {
      identifier: "AAPL",
      ticker: "AAPL",
      attribute: "price",
      attributeType: "quote",
      classification: "equity",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    // Check nodes exist
    assert.ok(graph.nodes.length > 0);
    assert.ok(graph.outputs.length === 1);

    // Check structure: InputNode → SymbolFastForwardNode → FirstSuccessNode → AttributeExtractionNode
    const inputNode = graph.nodes.find((n) => n instanceof InputNode);
    assert.ok(inputNode);
    assert.equal(inputNode.next.length, 2); // one for symbol node, one for attr node

    const symbolNode = graph.nodes.find((n) => n instanceof SymbolFastForwardNode);
    assert.ok(symbolNode);
    assert.equal(symbolNode.next.length, 1); // to quote node

    const quoteNode = graph.nodes.find((n) => n instanceof FirstSuccessNode);
    assert.ok(quoteNode);
    assert.equal(quoteNode.next.length, 1); // to attr node

    const attrNode = graph.nodes.find((n) => n instanceof AttributeExtractionNode);
    assert.ok(attrNode);
    assert.equal(graph.outputs[0], attrNode);
  });

  await t.test("builds ISIN graph with PH country code using PSE map", () => {
    const input = {
      identifier: "PH0231221307", // PH = Philippines
      ticker: "PH0231221307",
      attribute: "price",
      attributeType: "quote",
      classification: "isin",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    // Should have PseIsinMapNode, not YahooIsinSearchNode
    const pseNode = graph.nodes.find((n) => n instanceof PseIsinMapNode);
    assert.ok(pseNode);
    assert.equal(pseNode.executorId, "pse-isin-map");

    const yahooNode = graph.nodes.find((n) => n instanceof YahooIsinSearchNode);
    assert.strictEqual(yahooNode, undefined);
  });

  await t.test("builds ISIN graph with non-PH country code using Yahoo", () => {
    const input = {
      identifier: "US0378331005", // US = United States
      ticker: "US0378331005",
      attribute: "price",
      attributeType: "quote",
      classification: "isin",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    // Should have YahooIsinSearchNode, not PseIsinMapNode
    const yahooNode = graph.nodes.find((n) => n instanceof YahooIsinSearchNode);
    assert.ok(yahooNode);
    assert.equal(yahooNode.executorId, "yahoo-isin-search");

    const pseNode = graph.nodes.find((n) => n instanceof PseIsinMapNode);
    assert.strictEqual(pseNode, undefined);
  });

  await t.test("builds FX graph with LocalFx node", () => {
    const input = {
      identifier: "USD.PHP",
      ticker: "USD.PHP",
      attribute: "price",
      attributeType: "quote",
      classification: "fx",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: {
        baseCanonicalCode: "USD",
        quoteCanonicalCode: "PHP",
        yahooSymbol: "USDPHP=X",
        yahooChartSymbol: "USDPHP=X",
      },
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    // Should have LocalFxNode
    const fxNode = graph.nodes.find((n) => n instanceof LocalFxNode);
    assert.ok(fxNode);
    assert.equal(fxNode.executorId, "local-fx");

    // FX should NOT have quote node
    const quoteNode = graph.nodes.find((n) => n instanceof FirstSuccessNode);
    assert.strictEqual(quoteNode, undefined);
  });

  await t.test("graph outputs are unique per identifier", () => {
    const input = {
      identifier: "AAPL",
      ticker: "AAPL",
      attribute: "price",
      attributeType: "quote",
      classification: "equity",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    // Single identifier → single output
    assert.equal(graph.outputs.length, 1);
    assert.ok(graph.outputs[0] instanceof AttributeExtractionNode);
  });

  await t.test("node names are stable and unique in graph", () => {
    const input = {
      identifier: "AAPL",
      ticker: "AAPL",
      attribute: "price",
      attributeType: "quote",
      classification: "equity",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    const names = new Set();
    for (const node of graph.nodes) {
      assert.ok(typeof node.name === "string");
      assert.equal(node.name.length > 0, true);
      assert.equal(names.has(node.name), false, `Duplicate name: ${node.name}`);
      names.add(node.name);
    }

    assert.equal(names.size, graph.nodes.length);
  });

  await t.test("InputNode feeds both identifier and attribute nodes (diamond pattern)", () => {
    const input = {
      identifier: "AAPL",
      ticker: "AAPL",
      attribute: "price",
      attributeType: "quote",
      classification: "equity",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "USD",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      fxPair: null,
      infoMode: "",
      sourceOverride: "",
    };

    const graph = buildRoutingGraph(input, mockDeps);

    const inputNode = graph.nodes.find((n) => n.name.startsWith("input:"));
    assert.ok(inputNode);

    // InputNode should feed both identifier and attribute nodes
    // (via symbol-fast-forward and directly to attribute-extraction)
    assert.ok(inputNode.next.length >= 2, `InputNode has ${inputNode.next.length} next nodes, expected >= 2`);

    // Verify that both are actually in the graph
    const symbolNode = graph.nodes.find((n) => n.name.includes("symbol-fast-forward"));
    const attrNode = graph.nodes.find((n) => n.name.includes("attribute-extraction"));

    assert.ok(symbolNode);
    assert.ok(attrNode);
    assert.ok(inputNode.next.includes(symbolNode));
    assert.ok(inputNode.next.includes(attrNode));
  });
});
