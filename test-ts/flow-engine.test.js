const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FlowEngine,
  EnvelopeStatus,
} = require("../dist/ts/core/index.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock ResolveFlow for FlowEngine unit tests.
 * `nodes` is a map of id → { nextIds, resolveResult, kind? }
 * resolveResult: { status: "success"|"failure", value? }
 * kind: RoutingNodeKind — "leaf" (default), "switch", "try each", "step"
 */
function mockFlow(nodes) {
  function makeGraphNode(id) {
    const entry = nodes[id];
    return entry
      ? { id, type: "mock", next: entry.nextIds || [] }
      : null;
  }

  const graph = {
    getRoot: () => makeGraphNode("ROOT"),
    getTerminal: () => ({ id: "TERMINAL", type: "terminal", next: [] }),
    getNode: (id) => {
      if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
      return makeGraphNode(id);
    },
    getChildren: () => [],
    getParents: () => [],
    getTopologicalOrder: () => [],
  };

  return {
    getGraph: () => graph,
    getResolver: (id) => {
      if (id === "TERMINAL" || !nodes[id]) return null;
      const entry = nodes[id];
      return {
        resolve: () => entry.resolveResult,
        getRoutingNodeKind: () => entry.kind || "leaf",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Engine behaviour when flow returns null resolver (terminal node)
// ---------------------------------------------------------------------------

test("execute() treats a node with null resolver as terminal, returns current envelope", async () => {
  // ROOT has a next edge to a node whose resolver is null — engine should stop
  // and return the envelope produced by ROOT.
  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["LEAF"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["LEAF"] };
        if (id === "LEAF") return { id: "LEAF", type: "mock", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "ROOT") return { resolve: () => ({ status: "success", value: { done: true } }), getRoutingNodeKind: () => "leaf" };
      return null; // LEAF has no resolver — acts as terminal
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, { done: true });
});

test("execute() treats a node with null resolver as terminal even when it has siblings", async () => {
  // ROOT → [NULL-RESOLVER, REAL]. NULL-RESOLVER returns null from getResolver,
  // so engine sees it as terminal and returns success without trying REAL.
  let realCalled = false;

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["NULL-RESOLVER", "REAL"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["NULL-RESOLVER", "REAL"] };
        if (id === "NULL-RESOLVER") return { id: "NULL-RESOLVER", type: "mock", next: [] };
        if (id === "REAL") return { id: "REAL", type: "mock", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "ROOT") return { resolve: () => ({ status: "success", value: {} }), getRoutingNodeKind: () => "leaf" };
      if (id === "REAL") { realCalled = true; return { resolve: () => ({ status: "success", value: {} }), getRoutingNodeKind: () => "leaf" }; }
      return null; // NULL-RESOLVER
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.equal(realCalled, false, "sibling after null-resolver node should not be reached");
});

test("execute() throws when graph has no ROOT node", async () => {
  const flow = {
    getGraph: () => ({ getRoot: () => null, getNode: () => null }),
    getResolver: () => null,
  };

  const engine = new FlowEngine(flow);
  await assert.rejects(() => engine.execute({ value: {} }), /ROOT/);
});

// ---------------------------------------------------------------------------
// FlowEngine.execute()
// ---------------------------------------------------------------------------

test("execute() returns success envelope when single node succeeds and reaches TERMINAL", async () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { price: 42 } },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
});

test("execute() falls back to second next node when first fails", async () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["A", "B"],
      resolveResult: { status: "success", value: {} },
    },
    A: {
      nextIds: [],
      resolveResult: { status: "failure", error: "A failed" },
    },
    B: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { price: 7 } },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
});

test("execute() returns failure when all next nodes fail", async () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["A", "B"],
      resolveResult: { status: "success", value: {} },
    },
    A: {
      nextIds: [],
      resolveResult: { status: "failure", error: "A failed" },
    },
    B: {
      nextIds: [],
      resolveResult: { status: "failure", error: "B failed" },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
});

test("execute() does not try next edges when ROOT itself fails", async () => {
  let nextCalled = false;

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["A"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["A"] };
        if (id === "A") return { id: "A", type: "mock", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "ROOT") return { resolve: () => ({ status: "failure", error: "root failed" }), getRoutingNodeKind: () => "leaf" };
      if (id === "A") {
        nextCalled = true;
        return { resolve: () => ({ status: "success", value: {} }), getRoutingNodeKind: () => "leaf" };
      }
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(nextCalled, false, "next edge should not be tried when ROOT fails");
});



// ---------------------------------------------------------------------------
// Value threading
// ---------------------------------------------------------------------------

test("execute() passes the resolver output value into the next node", async () => {
  const receivedValues = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["NEXT"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["NEXT"] };
        if (id === "NEXT") return { id: "NEXT", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "ROOT") {
        return {
          resolve: (input) => {
            receivedValues.push({ node: "ROOT", input });
            return { status: "success", value: { fromRoot: true } };
          },
          getRoutingNodeKind: () => "leaf",
        };
      }
      if (id === "NEXT") {
        return {
          resolve: (input) => {
            receivedValues.push({ node: "NEXT", input });
            return { status: "success", value: { fromNext: true } };
          },
          getRoutingNodeKind: () => "leaf",
        };
      }
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: { initial: true } });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.equal(receivedValues[0].node, "ROOT");
  assert.deepEqual(receivedValues[0].input, { initial: true });
  assert.equal(receivedValues[1].node, "NEXT");
  assert.deepEqual(receivedValues[1].input, { fromRoot: true });
});

test("execute() retains the previous value when resolver returns null value", async () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: null },
    },
  });

  const engine = new FlowEngine(flow);
  const input = { kept: true };
  const result = await engine.execute({ value: input });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, input);
});

// ---------------------------------------------------------------------------
// Deep graph (multi-level)
// ---------------------------------------------------------------------------

test("execute() walks a three-level graph to TERMINAL", async () => {
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "A", type: "mock", next: ["B"] }),
      getNode: (id) => {
        if (id === "A") return { id: "A", type: "mock", next: ["B"] };
        if (id === "B") return { id: "B", type: "mock", next: ["C"] };
        if (id === "C") return { id: "C", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "TERMINAL") return null;
      return {
        resolve: () => {
          visited.push(id);
          return { status: "success", value: { step: id } };
        },
        getRoutingNodeKind: () => "leaf",
      };
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["A", "B", "C"]);
});

test("execute() skips missing next node and continues to next valid sibling", async () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["GHOST", "REAL"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["GHOST", "REAL"] };
        if (id === "REAL") return { id: "REAL", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
        return null; // GHOST missing
      },
    }),
    getResolver: (id) => {
      if (id === "ROOT") return { resolve: () => ({ status: "success", value: {} }), getRoutingNodeKind: () => "leaf" };
      if (id === "REAL") return { resolve: () => ({ status: "success", value: { real: true } }), getRoutingNodeKind: () => "leaf" };
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
});

// ---------------------------------------------------------------------------
// Node kinds
//
// The engine asks each resolved node for its RoutingNodeKind and dispatches
// child traversal accordingly:
//
//   "switch"   — children self-select via fast-fail; engine tries each in
//                order and returns first non-failure. Selection is expressed
//                through Failure, not through an out-of-band routing signal.
//
//   "try each" — engine tries children in order, returns first non-failure.
//                Mechanically identical to switch; semantically the children
//                are willing but may be transiently unavailable.
//
//   "step"     — engine runs ALL children in sequence; any child failure
//                stops execution immediately (no fallback to next sibling).
// ---------------------------------------------------------------------------

test("switch node: engine routes to the matching child via fast-fail on wrong branch", async () => {
  // SWITCH outputs { kind: "b" }. BRANCH-A rejects (Failure). BRANCH-B accepts.
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "SWITCH", type: "SwitchPlan", next: ["BRANCH-A", "BRANCH-B"] }),
      getNode: (id) => {
        if (id === "SWITCH") return { id: "SWITCH", type: "SwitchPlan", next: ["BRANCH-A", "BRANCH-B"] };
        if (id === "BRANCH-A") return { id: "BRANCH-A", type: "mock", next: ["TERMINAL"] };
        if (id === "BRANCH-B") return { id: "BRANCH-B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "SWITCH") {
        return {
          resolve: () => ({ status: "success", value: { kind: "b" } }),
          getRoutingNodeKind: () => "switch",
        };
      }
      if (id === "BRANCH-A") {
        return {
          resolve: (input) => {
            visited.push("BRANCH-A");
            if (input.kind !== "a") return { status: "failure", error: "wrong branch" };
            return { status: "success", value: input };
          },
          getRoutingNodeKind: () => "leaf",
        };
      }
      if (id === "BRANCH-B") {
        return {
          resolve: (input) => {
            visited.push("BRANCH-B");
            if (input.kind !== "b") return { status: "failure", error: "wrong branch" };
            return { status: "success", value: input };
          },
          getRoutingNodeKind: () => "leaf",
        };
      }
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["BRANCH-A", "BRANCH-B"]);
  assert.deepEqual(result.value, { kind: "b" });
});

test("switch node: engine returns Failure when no child can handle the output", async () => {
  const flow = mockFlow({
    ROOT: {
      kind: "switch",
      nextIds: ["BRANCH-A", "BRANCH-B"],
      resolveResult: { status: "success", value: { kind: "c" } },
    },
    "BRANCH-A": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "wrong branch" },
    },
    "BRANCH-B": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "wrong branch" },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
});

test("try-each node: engine tries children in order and returns first success", async () => {
  // PARENT → [PROVIDER-A, PROVIDER-B]: A fails transiently, B succeeds.
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "PARENT", type: "FirstSuccessPlan", next: ["PROVIDER-A", "PROVIDER-B"] }),
      getNode: (id) => {
        if (id === "PARENT") return { id: "PARENT", type: "FirstSuccessPlan", next: ["PROVIDER-A", "PROVIDER-B"] };
        if (id === "PROVIDER-A") return { id: "PROVIDER-A", type: "mock", next: ["TERMINAL"] };
        if (id === "PROVIDER-B") return { id: "PROVIDER-B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL") return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getResolver: (id) => {
      if (id === "PARENT") return {
        resolve: () => ({ status: "success", value: { ticker: "GOOG" } }),
        getRoutingNodeKind: () => "try each",
      };
      if (id === "PROVIDER-A") return {
        resolve: () => { visited.push("PROVIDER-A"); return { status: "failure", error: "unavailable" }; },
        getRoutingNodeKind: () => "leaf",
      };
      if (id === "PROVIDER-B") return {
        resolve: () => { visited.push("PROVIDER-B"); return { status: "success", value: { price: 180 } }; },
        getRoutingNodeKind: () => "leaf",
      };
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["PROVIDER-A", "PROVIDER-B"]);
  assert.deepEqual(result.value, { price: 180 });
});

test("try-each node: engine returns TerminalFailure when all providers fail", async () => {
  const flow = mockFlow({
    ROOT: {
      kind: "try each",
      nextIds: ["PROVIDER-A", "PROVIDER-B"],
      resolveResult: { status: "success", value: { ticker: "GOOG" } },
    },
    "PROVIDER-A": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "provider A down" },
    },
    "PROVIDER-B": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "provider B down" },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.TerminalFailure);
});

test("try-each node: TerminalFailure propagates up through an ancestor switch", async () => {
  // SWITCH → [TRY-EACH-A, FALLBACK]. TRY-EACH-A exhausts all children →
  // TerminalFailure. Engine must not try FALLBACK — TerminalFailure short-circuits.
  let fallbackCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "switch",
      nextIds: ["TRY-EACH-A", "FALLBACK"],
      resolveResult: { status: "success", value: {} },
    },
    "TRY-EACH-A": {
      kind: "try each",
      nextIds: ["PROVIDER"],
      resolveResult: { status: "success", value: {} },
    },
    "PROVIDER": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "unavailable" },
    },
    "FALLBACK": {
      kind: "leaf",
      nextIds: ["TERMINAL"],
      get resolveResult() {
        fallbackCalled = true;
        return { status: "success", value: { fallback: true } };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.TerminalFailure);
  assert.equal(fallbackCalled, false, "FALLBACK must not be called after TerminalFailure");
});

test("try-each node: succeeding first provider short-circuits remaining siblings", async () => {
  let bCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "try each",
      nextIds: ["PROVIDER-A", "PROVIDER-B"],
      resolveResult: { status: "success", value: {} },
    },
    "PROVIDER-A": {
      kind: "leaf",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { price: 10 } },
    },
    "PROVIDER-B": {
      kind: "leaf",
      nextIds: ["TERMINAL"],
      get resolveResult() {
        bCalled = true;
        return { status: "success", value: { price: 99 } };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.equal(bCalled, false, "PROVIDER-B should not be called when PROVIDER-A succeeds");
});

// ---------------------------------------------------------------------------
// Step node
// ---------------------------------------------------------------------------

test("step node: engine runs all children in sequence and succeeds when all pass", async () => {
  const visited = [];

  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["STEP-A", "STEP-B"],
      resolveResult: { status: "success", value: {} },
    },
    "STEP-A": {
      kind: "leaf",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { a: true } },
    },
    "STEP-B": {
      kind: "leaf",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { b: true } },
    },
  });

  // Patch resolvers to record visits
  const base = flow.getResolver.bind(flow);
  flow.getResolver = (id) => {
    const r = base(id);
    if (r) {
      const orig = r.resolve.bind(r);
      r.resolve = (input) => { visited.push(id); return orig(input); };
    }
    return r;
  };

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["ROOT", "STEP-A", "STEP-B"]);
});

test("step node: engine stops immediately when a child fails, does not try next sibling", async () => {
  let bCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["STEP-A", "STEP-B"],
      resolveResult: { status: "success", value: {} },
    },
    "STEP-A": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "step A failed" },
    },
    "STEP-B": {
      kind: "leaf",
      nextIds: [],
      get resolveResult() {
        bCalled = true;
        return { status: "success", value: {} };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(bCalled, false, "STEP-B should not be called when STEP-A fails");
});

test("step node: TerminalFailure from a child propagates immediately and stops execution", async () => {
  // ROOT (step) → [TRY-EACH, STEP-B]. TRY-EACH exhausts its only provider →
  // TerminalFailure. Engine must not call STEP-B.
  let bCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["TRY-EACH", "STEP-B"],
      resolveResult: { status: "success", value: {} },
    },
    "TRY-EACH": {
      kind: "try each",
      nextIds: ["PROVIDER"],
      resolveResult: { status: "success", value: {} },
    },
    "PROVIDER": {
      kind: "leaf",
      nextIds: [],
      resolveResult: { status: "failure", error: "unavailable" },
    },
    "STEP-B": {
      kind: "leaf",
      nextIds: [],
      get resolveResult() {
        bCalled = true;
        return { status: "success", value: {} };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = await engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.TerminalFailure);
  assert.equal(bCalled, false, "STEP-B must not be called after TerminalFailure");
});
