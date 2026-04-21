const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FlowEngine,
  EnvelopeStatus,
  FlowNode,
} = require("../../dist/ts/core/index.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock Flow for FlowEngine unit tests.
 * `nodes` is a map of id → { nextIds, resolveResult, kind?, canHandle?, selectNext? }
 * resolveResult: { status: "success"|"failure", value? }
 * kind: RoutingNodeKind — "step_forward" (default), "leaf", "switch", "try_each", "step"
 */
function mockFlow(nodes) {
  function getSelectedNodeCodes(context) {
    if (!(context.selectedNodeCodes instanceof Set)) {
      context.selectedNodeCodes = new Set();
    }
    return context.selectedNodeCodes;
  }

  function rememberSelected(context, code) {
    const selectedNodeCodes = getSelectedNodeCodes(context);
    selectedNodeCodes.add(code);
    return { id: code };
  }

  function defaultSelectNext(nodeId, entry, request, context = {}) {
    const nextIds = entry.nextIds || [];

    if (entry.kind === "switch") {
      return [];
    }

    if (entry.kind === "step") {
      const blockingChildId = nextIds.find((nextId) => {
        const childEntry = nodes[nextId];
        return childEntry?.canHandle && !childEntry.canHandle(request);
      });

      if (blockingChildId) {
        throw new Error(
          `Flow junction "${nodeId}" has child "${blockingChildId}" that cannot handle the current output.`,
        );
      }

      return nextIds.map((nextId) => rememberSelected(context, nextId));
    }

    const selectableIds = nextIds.filter((nextId) => {
      if (entry.kind !== "try_each") {
        return true;
      }

      const childEntry = nodes[nextId];
      return !childEntry?.canHandle || childEntry.canHandle(request);
    });

    const selectedId = selectableIds.find(
      (nextId) => !getSelectedNodeCodes(context).has(nextId),
    );

    return selectedId ? [rememberSelected(context, selectedId)] : [];
  }

  function makeGraphNode(id) {
    const entry = nodes[id];
    return entry ? { id, type: "mock", next: entry.nextIds || [] } : null;
  }

  const graph = {
    getRoot: () => makeGraphNode("ROOT"),
    getTerminal: () => ({ id: "TERMINAL", type: "terminal", next: [] }),
    getNode: (id) => {
      if (id === "TERMINAL")
        return { id: "TERMINAL", type: "terminal", next: [] };
      return makeGraphNode(id);
    },
    getChildren: () => [],
    getParents: () => [],
    getTopologicalOrder: () => [],
  };

  return {
    getGraph: () => graph,
    getNode: (id) => {
      if (id === "TERMINAL" || !nodes[id]) return null;
      const entry = nodes[id];
      return {
        execute: () => entry.resolveResult,
        canHandle: entry.canHandle ?? (() => true),
        ...(entry.selectNext ||
        entry.kind === "step" ||
        entry.kind === "try_each" ||
        entry.kind === "switch"
          ? {
              selectNext: entry.selectNext
                ? entry.selectNext
                : (request, context) =>
                    defaultSelectNext(id, entry, request, context),
            }
          : {}),
        getNodeKind: () =>
          entry.kind || ((entry.nextIds || []).length > 0 ? "step_forward" : "leaf"),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Engine behaviour when flow returns null node implementation (terminal node)
// ---------------------------------------------------------------------------

test("execute() treats a node with null node implementation as terminal, returns current envelope", () => {
  // ROOT has a next edge to a node whose implementation is null — engine should stop
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
    getNode: (id) => {
      if (id === "ROOT")
        return {
          execute:() => ({ status: "success", value: { done: true } }),
          getNodeKind: () => "step_forward",
        };
      return null; // LEAF has no runtime node — acts as terminal
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, { done: true });
});

test("execute() returns failure when a non-terminal leaf succeeds with no children", () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: [] }),
      getTerminal: () => ({ id: "TERMINAL", type: "terminal", next: [] }),
      getNode: (id) => (id === "ROOT" ? { id: "ROOT", type: "mock", next: [] } : null),
    }),
    getNode: (id) => {
      if (id !== "ROOT") {
        return null;
      }

      return {
        execute: () => ({ status: "success", value: { done: true } }),
        getNodeKind: () => "leaf",
      };
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.deepEqual(result.value, { done: true });
});

test("execute() throws when a step-forward node declares multiple children", () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "ROOT",
        type: "mock",
        next: ["NULL-RESOLVER", "REAL"],
      }),
      getNode: (id) => {
        if (id === "ROOT")
          return { id: "ROOT", type: "mock", next: ["NULL-RESOLVER", "REAL"] };
        if (id === "NULL-RESOLVER")
          return { id: "NULL-RESOLVER", type: "mock", next: [] };
        if (id === "REAL") return { id: "REAL", type: "mock", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT")
        return {
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "step_forward",
        };
      return null; // NULL-RESOLVER
    },
  };

  const engine = new FlowEngine(flow);
  assert.throws(
    () => engine.execute({ value: {} }),
    /StepForward node "ROOT" must declare exactly one child\./,
  );
});

test("execute() throws when graph has no ROOT node", () => {
  const flow = {
    getGraph: () => ({ getRoot: () => null, getNode: () => null }),
    getNode: () => null,
  };

  const engine = new FlowEngine(flow);
  assert.throws(() => engine.execute({ value: {} }), /ROOT/);
});

test("executeBounded() stops once the declared terminal node succeeds", () => {
  const trace = { visitedNodeIds: [] };
  const flow = mockFlow({
    ROOT: {
      nextIds: ["A"],
      resolveResult: { status: "success", value: {} },
    },
    A: {
      nextIds: ["B"],
      resolveResult: { status: "success", value: { at: "A" } },
    },
    B: {
      nextIds: ["C"],
      resolveResult: { status: "success", value: { at: "B" } },
    },
    C: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { at: "C" } },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.executeBounded("A", "B", { value: {} }, trace);

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, { at: "B" });
  assert.deepEqual(trace.visitedNodeIds, ["A", "B"]);
});

test("executeBounded() stops a step node after the bounded terminal child succeeds", () => {
  let siblingCalled = false;
  const trace = { visitedNodeIds: [] };
  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["A", "B"],
      resolveResult: { status: "success", value: {} },
    },
    A: {
      nextIds: ["A-END"],
      resolveResult: { status: "success", value: { at: "A" } },
    },
    "A-END": {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { at: "A-END" } },
    },
    B: {
      nextIds: [],
      get resolveResult() {
        siblingCalled = true;
        return { status: "success", value: { at: "B" } };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.executeBounded("ROOT", "A-END", { value: {} }, trace);

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, { at: "A-END" });
  assert.equal(siblingCalled, false);
  assert.deepEqual(trace.visitedNodeIds, ["ROOT", "A", "A-END"]);
});

// ---------------------------------------------------------------------------
// FlowEngine.execute()
// ---------------------------------------------------------------------------

test("execute() returns success envelope when single node succeeds and reaches TERMINAL", () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { price: 42 } },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
});

test("execute() falls back to second next node when first fails", () => {
  const flow = mockFlow({
    ROOT: {
      kind: "leaf",
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
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
});

test("execute() returns failure when all next nodes fail", () => {
  const flow = mockFlow({
    ROOT: {
      kind: "leaf",
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
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(result.error, "B failed");
});

test("execute() preserves the last user-facing leaf failure message", () => {
  const flow = mockFlow({
    ROOT: {
      kind: "leaf",
      nextIds: ["A", "B"],
      resolveResult: { status: "success", value: {} },
    },
    A: {
      nextIds: [],
      resolveResult: { status: "failure", error: "Yahoo quote lookup failed." },
    },
    B: {
      nextIds: [],
      resolveResult: {
        status: "failure",
        error: 'No LON ISIN is available for "SJPA".',
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(result.error, 'No LON ISIN is available for "SJPA".');
});

test("execute() does not try next edges when ROOT itself fails", () => {
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
    getNode: (id) => {
      if (id === "ROOT")
        return {
          execute:() => ({ status: "failure", error: "root failed" }),
          getNodeKind: () => "step_forward",
        };
      if (id === "A") {
        nextCalled = true;
        return {
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "leaf",
        };
      }
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(
    nextCalled,
    false,
    "next edge should not be tried when ROOT fails",
  );
});

// ---------------------------------------------------------------------------
// Value threading
// ---------------------------------------------------------------------------

test("execute() passes the node output value into the next node", () => {
  const receivedValues = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["NEXT"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["NEXT"] };
        if (id === "NEXT")
          return { id: "NEXT", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT") {
        return {
          execute:(input) => {
            receivedValues.push({ node: "ROOT", input });
            return { status: "success", value: { fromRoot: true } };
          },
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      }
      if (id === "NEXT") {
        return {
          execute:(input) => {
            receivedValues.push({ node: "NEXT", input });
            return { status: "success", value: { fromNext: true } };
          },
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      }
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: { initial: true } });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.equal(receivedValues[0].node, "ROOT");
  assert.deepEqual(receivedValues[0].input, { initial: true });
  assert.equal(receivedValues[1].node, "NEXT");
  assert.deepEqual(receivedValues[1].input, { fromRoot: true });
});

test("execute() retains the previous value when a node returns null value", () => {
  const flow = mockFlow({
    ROOT: {
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: null },
    },
  });

  const engine = new FlowEngine(flow);
  const input = { kept: true };
  const result = engine.execute({ value: input });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(result.value, input);
});

// ---------------------------------------------------------------------------
// Deep graph (multi-level)
// ---------------------------------------------------------------------------

test("execute() walks a three-level graph to TERMINAL", () => {
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "A", type: "mock", next: ["B"] }),
      getNode: (id) => {
        if (id === "A") return { id: "A", type: "mock", next: ["B"] };
        if (id === "B") return { id: "B", type: "mock", next: ["C"] };
        if (id === "C") return { id: "C", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "TERMINAL") return null;
      return {
        execute: () => {
          visited.push(id);
          return { status: "success", value: { step: id } };
        },
        canHandle: () => true,
        getNodeKind: () => "step_forward",
      };
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["A", "B", "C"]);
});

test("execute() throws when a step-forward node has multiple next nodes", () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["A", "B"] }),
      getNode: (id) => {
        if (id === "ROOT")
          return { id: "ROOT", type: "mock", next: ["A", "B"] };
        if (id === "A")
          return { id: "A", type: "mock", next: ["TERMINAL"] };
        if (id === "B")
          return { id: "B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT")
        return {
          execute:() => ({ status: "success", value: {} }),
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  assert.throws(
    () => engine.execute({ value: {} }),
    /StepForward node "ROOT" must declare exactly one child\./,
  );
});

// ---------------------------------------------------------------------------
// Node kinds
//
// The engine asks each runtime node for its RoutingNodeKind and dispatches
// child traversal accordingly:
//
//   "switch"   — select exactly one child via selectNext() and route only to
//                that child. No sibling failover is allowed.
//
//   "try_each" — select one handleable child per call and let the engine keep
//                asking until one succeeds or all eligible children fail.
//
//   "step"     — select all children in one call after first asserting that
//                every child can handle the current output.
// ---------------------------------------------------------------------------

test("switch node: engine routes only to the matching child", () => {
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "SWITCH",
        type: "SwitchPlan",
        next: ["BRANCH-A", "BRANCH-B"],
      }),
      getNode: (id) => {
        if (id === "SWITCH")
          return {
            id: "SWITCH",
            type: "SwitchPlan",
            next: ["BRANCH-A", "BRANCH-B"],
          };
        if (id === "BRANCH-A")
          return { id: "BRANCH-A", type: "mock", next: ["TERMINAL"] };
        if (id === "BRANCH-B")
          return { id: "BRANCH-B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "SWITCH") {
        return {
          selectNext: () => [{ id: "BRANCH-B" }],
          getNodeKind: () => "switch",
        };
      }
      if (id === "BRANCH-A") {
        return {
          execute:(input) => {
            visited.push("BRANCH-A");
            return { status: "success", value: input };
          },
          getNodeKind: () => "step_forward",
        };
      }
      if (id === "BRANCH-B") {
        return {
          execute:(input) => {
            visited.push("BRANCH-B");
            return { status: "success", value: input };
          },
          getNodeKind: () => "step_forward",
        };
      }
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: { kind: "b" } });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["BRANCH-B"]);
  assert.deepEqual(result.value, { kind: "b" });
});

test("switch node: engine returns Failure when no child can handle the output", () => {
  const flow = mockFlow({
    ROOT: {
      kind: "switch",
      nextIds: ["BRANCH-A", "BRANCH-B"],
      selectNext: () => [],
      resolveResult: { status: "success", value: { kind: "c" } },
    },
    "BRANCH-A": {
      kind: "leaf",
      nextIds: [],
      canHandle: () => false,
      resolveResult: { status: "failure", error: "wrong branch" },
    },
    "BRANCH-B": {
      kind: "leaf",
      nextIds: [],
      canHandle: () => false,
      resolveResult: { status: "failure", error: "wrong branch" },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
});

test("switch node: engine propagates selection errors from selectNext()", () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "SWITCH", type: "SwitchPlan", next: ["A", "B"] }),
      getNode: (id) => {
        if (id === "SWITCH")
          return { id: "SWITCH", type: "SwitchPlan", next: ["A", "B"] };
        if (id === "A") return { id: "A", type: "mock", next: [] };
        if (id === "B") return { id: "B", type: "mock", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "SWITCH") {
        return {
          selectNext: () => {
            throw new Error("ambiguous selection");
          },
          getNodeKind: () => "switch",
        };
      }
      if (id === "A" || id === "B") {
        return {
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "leaf",
        };
      }
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  assert.throws(() => engine.execute({ value: {} }), /ambiguous selection/i);
});

test("routing node: engine throws when a non-leaf node inherits the base selectNext()", () => {
  const rootFlowNode = new FlowNode("ROOT");
  rootFlowNode.getNodeKind = () => "switch";

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["A"] }),
      getNode: (id) => {
        if (id === "ROOT") return { id: "ROOT", type: "mock", next: ["A"] };
        if (id === "A") return { id: "A", type: "mock", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT") {
        return rootFlowNode;
      }

      if (id === "A") {
        return {
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "leaf",
        };
      }

      return null;
    },
  };

  const engine = new FlowEngine(flow);
  assert.throws(
    () => engine.execute({ value: {} }),
    /does not support selectNext/i,
  );
});

test("try-each node: engine tries children in order and returns first success", () => {
  // PARENT → [PROVIDER-A, PROVIDER-B]: A fails transiently, B succeeds.
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "PARENT",
        type: "FirstSuccessPlan",
        next: ["PROVIDER-A", "PROVIDER-B"],
      }),
      getNode: (id) => {
        if (id === "PARENT")
          return {
            id: "PARENT",
            type: "FirstSuccessPlan",
            next: ["PROVIDER-A", "PROVIDER-B"],
          };
        if (id === "PROVIDER-A")
          return { id: "PROVIDER-A", type: "mock", next: ["TERMINAL"] };
        if (id === "PROVIDER-B")
          return { id: "PROVIDER-B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "PARENT")
        return {
          execute:() => ({ status: "success", value: { ticker: "GOOG" } }),
          getNodeKind: () => "try_each",
          selectNext: (_request, context = {}) => {
            if (!(context.selectedNodeCodes instanceof Set)) {
              context.selectedNodeCodes = new Set();
            }

            const nextCode = ["PROVIDER-A", "PROVIDER-B"].find(
              (code) => !context.selectedNodeCodes.has(code),
            );

            if (!nextCode) {
              return [];
            }

            context.selectedNodeCodes.add(nextCode);
            return [{ id: nextCode }];
          },
        };
      if (id === "PROVIDER-A")
        return {
          canHandle: () => true,
          execute:() => {
            visited.push("PROVIDER-A");
            return { status: "failure", error: "unavailable" };
          },
          getNodeKind: () => "leaf",
        };
      if (id === "PROVIDER-B")
        return {
          canHandle: () => true,
          execute:() => {
            visited.push("PROVIDER-B");
            return { status: "success", value: { price: 180 } };
          },
          getNodeKind: () => "step_forward",
        };
      return null; // TERMINAL
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["PROVIDER-A", "PROVIDER-B"]);
  assert.deepEqual(result.value, { price: 180 });
});

test("try-each node: engine skips children that cannot handle the output", () => {
  const visited = [];

  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "PARENT",
        type: "FirstSuccessPlan",
        next: ["A", "B"],
      }),
      getNode: (id) => {
        if (id === "PARENT")
          return { id: "PARENT", type: "FirstSuccessPlan", next: ["A", "B"] };
        if (id === "A") return { id: "A", type: "mock", next: [] };
        if (id === "B") return { id: "B", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "PARENT")
        return {
          execute:() => ({ status: "success", value: { provider: "B" } }),
          getNodeKind: () => "try_each",
          selectNext: (request, context = {}) => {
            if (!(context.selectedNodeCodes instanceof Set)) {
              context.selectedNodeCodes = new Set();
            }

            const nextCode = ["A", "B"].find((code) => {
              if (context.selectedNodeCodes.has(code)) {
                return false;
              }

              const childFlowNode = flow.getNode(code);
              return (
                !childFlowNode?.canHandle || childFlowNode.canHandle(request)
              );
            });

            if (!nextCode) {
              return [];
            }

            context.selectedNodeCodes.add(nextCode);
            return [{ id: nextCode }];
          },
        };
      if (id === "A")
        return {
          canHandle: () => false,
          execute:() => {
            visited.push("A");
            return { status: "success", value: { wrong: true } };
          },
          getNodeKind: () => "leaf",
        };
      if (id === "B")
        return {
          canHandle: () => true,
          execute:() => {
            visited.push("B");
            return { status: "success", value: { price: 180 } };
          },
          getNodeKind: () => "step_forward",
        };
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["B"]);
  assert.deepEqual(result.value, { price: 180 });
});

test("try-each node: engine returns Failure with exhaustion message when all providers fail", () => {
  const flow = mockFlow({
    ROOT: {
      kind: "try_each",
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
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.ok(result.error, "should have an error when all providers fail");
});

test("try-each node: Failure from exhausted try-each propagates through ancestor switch without triggering fallback", () => {
  // SWITCH selects TRY-EACH-A. TRY-EACH-A exhausts all children →
  // Failure. SWITCH returns that result directly; FALLBACK must not be called.
  let fallbackCalled = false;

  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "ROOT",
        type: "SwitchPlan",
        next: ["TRY-EACH-A", "FALLBACK"],
      }),
      getNode: (id) => {
        if (id === "ROOT")
          return {
            id: "ROOT",
            type: "SwitchPlan",
            next: ["TRY-EACH-A", "FALLBACK"],
          };
        if (id === "TRY-EACH-A")
          return {
            id: "TRY-EACH-A",
            type: "FirstSuccessPlan",
            next: ["PROVIDER"],
          };
        if (id === "PROVIDER")
          return { id: "PROVIDER", type: "mock", next: [] };
        if (id === "FALLBACK")
          return { id: "FALLBACK", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT")
        return {
          selectNext: () => [{ id: "TRY-EACH-A" }],
          getNodeKind: () => "switch",
        };
      if (id === "TRY-EACH-A")
        return {
          getNodeKind: () => "try_each",
          selectNext: (_request, context = {}) => {
            if (!(context.selectedNodeCodes instanceof Set)) {
              context.selectedNodeCodes = new Set();
            }

            if (context.selectedNodeCodes.has("PROVIDER")) {
              return [];
            }

            context.selectedNodeCodes.add("PROVIDER");
            return [{ id: "PROVIDER" }];
          },
        };
      if (id === "PROVIDER")
        return {
          canHandle: () => true,
          execute:() => ({ status: "failure", error: "unavailable" }),
          getNodeKind: () => "leaf",
        };
      if (id === "FALLBACK")
        return {
          canHandle: () => false,
          execute:() => {
            fallbackCalled = true;
            return { status: "success", value: { fallback: true } };
          },
          getNodeKind: () => "leaf",
        };
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(
    fallbackCalled,
    false,
    "FALLBACK must not be called after try-each exhaustion",
  );
});

test("try-each node: succeeding first provider short-circuits remaining siblings", () => {
  let bCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "try_each",
      nextIds: ["PROVIDER-A", "PROVIDER-B"],
      resolveResult: { status: "success", value: {} },
    },
    "PROVIDER-A": {
      kind: "step_forward",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { price: 10 } },
    },
    "PROVIDER-B": {
      kind: "step_forward",
      nextIds: ["TERMINAL"],
      get resolveResult() {
        bCalled = true;
        return { status: "success", value: { price: 99 } };
      },
    },
  });

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.equal(
    bCalled,
    false,
    "PROVIDER-B should not be called when PROVIDER-A succeeds",
  );
});

// ---------------------------------------------------------------------------
// Step node
// ---------------------------------------------------------------------------

test("step node: engine fans out the same output to all children", () => {
  const visited = [];
  const seenInputs = [];

  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["STEP-A", "STEP-B"],
      resolveResult: { status: "success", value: {} },
    },
    "STEP-A": {
      kind: "step_forward",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { a: true } },
    },
    "STEP-B": {
      kind: "step_forward",
      nextIds: ["TERMINAL"],
      resolveResult: { status: "success", value: { b: true } },
    },
  });

  // Patch runtime nodes to record visits
  const base = flow.getNode.bind(flow);
  flow.getNode = (id) => {
    const r = base(id);
    if (r) {
      const orig = r.execute.bind(r);
      r.execute = (input) => {
        visited.push(id);
        seenInputs.push([id, input]);
        return orig(input);
      };
    }
    return r;
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  assert.deepEqual(visited, ["STEP-A", "STEP-B"]);
  assert.deepEqual(seenInputs, [
    ["STEP-A", {}],
    ["STEP-B", {}],
  ]);
  assert.deepEqual(result.value, {});
});

test("step node: engine stops immediately when a child fails, does not try later siblings", () => {
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
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(bCalled, false, "STEP-B should not be called when STEP-A fails");
});

test("step node: throws when a child cannot handle the output", () => {
  const flow = {
    getGraph: () => ({
      getRoot: () => ({
        id: "ROOT",
        type: "StepPlan",
        next: ["STEP-A", "STEP-B"],
      }),
      getNode: (id) => {
        if (id === "ROOT")
          return { id: "ROOT", type: "StepPlan", next: ["STEP-A", "STEP-B"] };
        if (id === "STEP-A") return { id: "STEP-A", type: "mock", next: [] };
        if (id === "STEP-B") return { id: "STEP-B", type: "mock", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT") {
        return {
          getNodeKind: () => "step",
          selectNext: (request) => {
            if (!flow.getNode("STEP-B").canHandle(request)) {
              throw new Error(
                'Flow junction "ROOT" has child "STEP-B" that cannot handle the current output.',
              );
            }

            return [{ id: "STEP-A" }, { id: "STEP-B" }];
          },
        };
      }
      if (id === "STEP-A") {
        return {
          canHandle: () => true,
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "leaf",
        };
      }
      if (id === "STEP-B") {
        return {
          canHandle: () => false,
          execute:() => ({ status: "success", value: {} }),
          getNodeKind: () => "leaf",
        };
      }
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  assert.throws(
    () => engine.execute({ value: {} }),
    /cannot handle the current output/i,
  );
});

test("step node: Failure from an exhausted try-each child stops execution immediately", () => {
  // ROOT (step) → [TRY-EACH, STEP-B]. TRY-EACH exhausts its only provider →
  // Failure. Engine must not call STEP-B.
  let bCalled = false;

  const flow = mockFlow({
    ROOT: {
      kind: "step",
      nextIds: ["TRY-EACH", "STEP-B"],
      resolveResult: { status: "success", value: {} },
    },
    "TRY-EACH": {
      kind: "try_each",
      nextIds: ["PROVIDER"],
      resolveResult: { status: "success", value: {} },
    },
    PROVIDER: {
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
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Failure);
  assert.equal(
    bCalled,
    false,
    "STEP-B must not be called after try-each exhaustion",
  );
});

test("execute() passes node output to children without transforming its shape", () => {
  let wrapperInput = null;
  let leafInput = null;

  const rootOutput = {
    requestInput: { ticker: "GOOG" },
    resolvedRequest: { requestType: "equity", symbol: "GOOG" },
  };
  const wrapperOutput = {
    requestInput: { nested: true },
    resolvedRequest: null,
  };

  const flow = {
    getGraph: () => ({
      getRoot: () => ({ id: "ROOT", type: "mock", next: ["WRAPPER"] }),
      getNode: (id) => {
        if (id === "ROOT")
          return { id: "ROOT", type: "mock", next: ["WRAPPER"] };
        if (id === "WRAPPER")
          return { id: "WRAPPER", type: "mock", next: ["LEAF"] };
        if (id === "LEAF")
          return { id: "LEAF", type: "mock", next: ["TERMINAL"] };
        if (id === "TERMINAL")
          return { id: "TERMINAL", type: "terminal", next: [] };
        return null;
      },
    }),
    getNode: (id) => {
      if (id === "ROOT") {
        return {
          execute:() => ({ status: "success", value: rootOutput }),
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      }
      if (id === "WRAPPER") {
        return {
          execute:(input) => {
            wrapperInput = input;
            return { status: "success", value: wrapperOutput };
          },
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      }
      if (id === "LEAF") {
        return {
          execute:(input) => {
            leafInput = input;
            return { status: "success", value: input };
          },
          canHandle: () => true,
          getNodeKind: () => "step_forward",
        };
      }
      return null;
    },
  };

  const engine = new FlowEngine(flow);
  const result = engine.execute({ value: {} });

  assert.equal(result.status, EnvelopeStatus.Success);
  // Engine passes ROOT's output to WRAPPER unchanged — no shape-based unwrapping.
  assert.deepEqual(wrapperInput, rootOutput);
  // Engine passes WRAPPER's output to LEAF unchanged.
  assert.deepEqual(leafInput, wrapperOutput);
});
