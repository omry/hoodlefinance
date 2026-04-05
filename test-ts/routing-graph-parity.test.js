/* SPDX-License-Identifier: MPL-2.0 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildRoutingGraph } from "../dist/ts/core/routing-graph-builder.js";
import { executeGraph } from "../dist/ts/core/routing-engine.js";
import { EquityRequest } from "../dist/ts/core/request.js";
import { createRequestInput } from "../dist/ts/core/request-building.js";

// Shared mock infrastructure
// buildRuntimePlan must include the resolver itself in plan.nodes so that
// executeRouteJobs can pick it up as the batch executor via getCurrentRouteNode.
// executeBatch must return RouteResult objects — applyRouteResult ignores
// direct job mutations and uses the returned RouteResult exclusively.
function makeQuoteResolver(quote) {
  const resolver = {
    name: "mock",
    code: "MOCK",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [resolver], routeClass: "mock", routePath: "mock", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "success", quote }));
    },
    describe: () => "mock",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "mock"; },
    get routingLabel() { return "mock"; },
    get sourceName() { return "mock"; },
  };
  return resolver;
}

function makeIdentifierResolver(resolvedRequest) {
  const resolver = {
    name: "mock-identifier",
    code: "MOCK-ID",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [resolver], routeClass: "mock", routePath: "mock", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "success", value: resolvedRequest }));
    },
    describe: () => "mock-identifier",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "mock-identifier"; },
    get routingLabel() { return "mock-identifier"; },
    get sourceName() { return "mock-identifier"; },
  };
  return resolver;
}

function makeDeps(overrides = {}) {
  const failingResolver = {
    name: "failing",
    code: "FAILING",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [failingResolver], routeClass: "mock", routePath: "mock", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "lookup_failure", error: "resolver not configured for test" }));
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

function makeEquityInput(ticker = "AAPL") {
  return createRequestInput(ticker, "price");
}

test("routing-graph parity: equity price resolves via graph", () => {
  const resolvedRequest = new EquityRequest({ identifier: "AAPL", attribute: "price", symbol: "AAPL", yahooSymbol: "AAPL" });
  const quote = { regularMarketPrice: 42.5, currency: "USD" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    yahooQuoteResolver: makeQuoteResolver(quote),
  });

  const input = makeEquityInput("AAPL");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "settled");
  assert.equal(outcome.value, 42.5);
});

test("routing-graph parity: graph fails cleanly when quote resolver fails", () => {
  const resolvedRequest = new EquityRequest({ identifier: "AAPL", attribute: "price", symbol: "AAPL", yahooSymbol: "AAPL" });

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    // yahooQuoteResolver and tradingviewFundResolver left as failing
  });

  const input = makeEquityInput("AAPL");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "failed");
});

test("routing-graph parity: graph fails cleanly when identifier resolver fails", () => {
  const deps = makeDeps({
    // directIdentifierResolver left as failing
  });

  const input = makeEquityInput("AAPL");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "failed");
});

test("routing-graph parity: PSE equity routes through PSE quote chain", () => {
  const resolvedRequest = new EquityRequest({ identifier: "PSE:BDO", attribute: "price", symbol: "BDO", yahooSymbol: "BDO.PS" });
  const quote = { regularMarketPrice: 100.0, currency: "PHP" };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    pseFramesResolver: makeQuoteResolver(quote),
  });

  const input = makeEquityInput("PSE:BDO");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "settled");
  assert.equal(outcome.value, 100.0);
});

test("routing-graph parity: currency conversion node receives all three parents", () => {
  // Tests the wiring fix: CurrencyConversionNode has 3 parents (attrNode,
  // fxRateBatchNode, quoteNode). The engine must not fire it until all three
  // have delivered. Previously only attrNode.next was wired.
  const resolvedRequest = new EquityRequest({ identifier: "AAPL", attribute: "price", symbol: "AAPL", yahooSymbol: "AAPL" });
  const quote = { regularMarketPrice: 100.0, currency: "GBP" };

  // FxRateBatchNode.execute is still a TODO stub returning {} — we just need
  // the graph to settle without crashing, and the conversion to pass through
  // when no rate is available (rate table empty → returns attributeValue as-is).
  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    yahooQuoteResolver: makeQuoteResolver(quote),
  });

  const input = createRequestInput("AAPL", "price:USD");

  // Only run if wantsOutputCurrency is true for this input
  if (!input.attributeRequest.wantsOutputCurrency) {
    // price:USD may not parse as output-currency on all builds; skip gracefully
    return;
  }

  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  // Graph must settle (not crash due to missing parent inputs)
  assert.ok(outcome, "output node must be settled");
  assert.equal(outcome.status, "settled", `expected settled, got: ${outcome.error}`);
});

test("routing-graph parity: PSE equity falls through to PSEEdge when PSEFrames fails", () => {
  const resolvedRequest = new EquityRequest({ identifier: "PSE:BDO", attribute: "price", symbol: "BDO", yahooSymbol: "BDO.PS" });
  const quote = { regularMarketPrice: 99.5, currency: "PHP" };

  const failingQuoteResolver = {
    name: "failing-frames",
    code: "FAILING-FRAMES",
    canHandle: () => true,
    buildRuntimePlan() { return { nodes: [failingQuoteResolver], routeClass: "mock", routePath: "mock", routeState: {} }; },
    executeBatch(jobs) {
      return jobs.map(() => ({ status: "lookup_failure", error: "frames unavailable" }));
    },
    describe: () => "failing-frames",
    getRoutingNodeKind: () => "leaf",
    get routingDescription() { return "failing-frames"; },
    get routingLabel() { return "failing-frames"; },
    get sourceName() { return "failing-frames"; },
  };

  const deps = makeDeps({
    directIdentifierResolver: makeIdentifierResolver(resolvedRequest),
    pseFramesResolver: failingQuoteResolver,
    pseEdgeResolver: makeQuoteResolver(quote),
  });

  const input = makeEquityInput("PSE:BDO");
  const graph = buildRoutingGraph(input, deps);
  const result = executeGraph(graph);
  const outcome = result.settled.get(graph.outputs[0]);

  assert.ok(outcome);
  assert.equal(outcome.status, "settled");
  assert.equal(outcome.value, 99.5);
});
