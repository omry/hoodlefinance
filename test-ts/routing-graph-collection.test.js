/* SPDX-License-Identifier: MPL-2.0 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRoutingGraph,
  executeGraph,
  createRequestInput,
  EquityRequest,
} from "../dist/ts/core/index.js";

/**
 * Phase 4.2a Collection: Compare routing graph (new path) results with expected behavior.
 * These tests verify that the graph path produces sensible results for representative
 * scenarios. Full parity with old path tested separately after basic functionality verified.
 */

function makeQuoteResolver(quote) {
  const resolver = {
    name: "quote-resolver",
    code: "QUOTE",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [resolver], routeClass: "mock", routePath: "quote", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "success", quote }));
    },
    describe: () => "quote-resolver",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "quote-resolver"; },
    get routingLabel() { return "quote-resolver"; },
    get sourceName() { return "quote-resolver"; },
  };
  return resolver;
}

function makeIdentifierResolver(resolvedRequest) {
  const resolver = {
    name: "identifier-resolver",
    code: "IDENTIFIER",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [resolver], routeClass: "mock", routePath: "id", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "success", value: resolvedRequest }));
    },
    describe: () => "identifier-resolver",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "identifier-resolver"; },
    get routingLabel() { return "identifier-resolver"; },
    get sourceName() { return "identifier-resolver"; },
  };
  return resolver;
}

function makeDeps(overrides = {}) {
  const failingResolver = {
    name: "failing",
    code: "FAILING",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [failingResolver], routeClass: "mock", routePath: "fail", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "lookup_failure", error: "not available" }));
    },
    describe: () => "failing",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "failing"; },
    get routingLabel() { return "failing"; },
    get sourceName() { return "failing"; },
  };

  return {
    directIdentifierResolver: failingResolver,
    yahooIsinSearchResolver: failingResolver,
    pseIsinMapResolver: failingResolver,
    localFxResolver: failingResolver,
    googleFxResolver: failingResolver,
    yahooQuoteResolver: failingResolver,
    pseEdgeResolver: failingResolver,
    pseFramesResolver: failingResolver,
    tradingviewFundResolver: failingResolver,
    isinDeps: {
      fetchText: () => "",
      getCachedString: () => "",
      looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(v)),
      putCachedString: (_k, v) => v,
    },
    ...overrides,
  };
}

// Collection test 1: Basic equity resolution
test("collection: equity resolves to numeric quote value", () => {
  const resolvedRequest = new EquityRequest({
    identifier: "AAPL",
    attribute: "price",
    symbol: "AAPL",
    yahooSymbol: "AAPL",
  });
  const quote = { regularMarketPrice: 150.25, currency: "USD" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    yahooQuoteResolver: makeQuoteResolver(quote),
  });

  const input = createRequestInput("AAPL", "price");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome, "output should be settled");
  assert.equal(outcome.status, "settled", "should settle successfully");
  assert.equal(outcome.value, 150.25, "should extract quote price");
});

// Collection test 2: Identifier resolution failure
test("collection: graph fails when identifier resolution fails", () => {
  const deps = makeDeps({
    // directIdentifierResolver left as failing
  });

  const input = createRequestInput("BADTICKER", "price");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "failed", "should fail gracefully");
});

// Collection test 3: Quote resolution failure
test("collection: graph fails when quote resolution fails", () => {
  const resolvedRequest = new EquityRequest({
    identifier: "AAPL",
    attribute: "price",
    symbol: "AAPL",
    yahooSymbol: "AAPL",
  });

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    // yahooQuoteResolver left as failing
  });

  const input = createRequestInput("AAPL", "price");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "failed", "should fail when quote resolver fails");
});

// Collection test 4: Different attribute extraction
test("collection: extracts different quote attributes correctly", () => {
  const resolvedRequest = new EquityRequest({
    identifier: "GOOG",
    attribute: "currency",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  });
  const quote = { regularMarketPrice: 140.5, currency: "USD", exchange: "NASDAQ" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    yahooQuoteResolver: makeQuoteResolver(quote),
  });

  const input = createRequestInput("GOOG", "currency");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "settled");
  assert.equal(outcome.value, "USD", "should extract currency attribute");
});

// Collection test 5: Graph node count and structure
test("collection: graph has expected structure for equity + price", () => {
  const resolvedRequest = new EquityRequest({
    identifier: "MSFT",
    attribute: "price",
    symbol: "MSFT",
    yahooSymbol: "MSFT",
  });
  const quote = { regularMarketPrice: 380.0, currency: "USD" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    yahooQuoteResolver: makeQuoteResolver(quote),
  });

  const input = createRequestInput("MSFT", "price");
  const graph = buildRoutingGraph(input, deps);

  // Expected: InputNode, SymbolFastForwardNode, FirstSuccessNode (quote), AttributeExtractionNode
  // At minimum: 4 nodes + join point = ~5 nodes
  assert.ok(graph.nodes.length >= 4, `graph should have at least 4 nodes, got ${graph.nodes.length}`);
  assert.equal(graph.outputs.length, 1, "should have one output node");
});

// Collection test 6: PSE equity uses PSE quote nodes
test("collection: PSE equity uses PSE-specific routing", () => {
  const resolvedRequest = new EquityRequest({
    identifier: "PSE:BDO",
    attribute: "price",
    symbol: "BDO",
    yahooSymbol: "BDO.PS",
  });
  const quote = { regularMarketPrice: 105.0, currency: "PHP" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    pseFramesResolver: makeQuoteResolver(quote),
  });

  const input = createRequestInput("PSE:BDO", "price");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "settled");
  assert.equal(outcome.value, 105.0, "PSE quote should resolve");
});
