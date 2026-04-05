/* SPDX-License-Identifier: MPL-2.0 */

import assert from "node:assert/strict";
import test from "node:test";
import { executeGraph } from "../dist/ts/core/routing-engine.js";

// Mock node for testing
class MockNode {
  constructor(name, next = [], executeImpl = null) {
    this.name = name;
    this.next = next;
    this.executeImpl = executeImpl || ((inputs) => ({ result: name }));
  }

  execute(inputs) {
    return this.executeImpl(inputs);
  }
}

test("routing-engine", async (t) => {
  await t.test("root node settles immediately with empty inputs", () => {
    const root = new MockNode("root");
    const graph = { nodes: [root], outputs: [root] };

    const result = executeGraph(graph);

    assert.ok(result.settled.has(root));
    assert.equal(result.settled.get(root).status, "settled");
    assert.deepEqual(result.settled.get(root).value, { result: "root" });
  });

  await t.test("linear chain A→B→C settles in order with parent values passed", () => {
    const a = new MockNode("a");
    const b = new MockNode("b");
    const c = new MockNode("c");
    a.next = [b];
    b.next = [c];

    const graph = { nodes: [a, b, c], outputs: [c] };
    const result = executeGraph(graph);

    // All should be settled
    assert.equal(result.settled.get(a).status, "settled");
    assert.equal(result.settled.get(b).status, "settled");
    assert.equal(result.settled.get(c).status, "settled");

    // B should have received A's value
    assert.deepEqual(result.settled.get(b).value, { result: "b" });

    // C should have received B's value
    assert.deepEqual(result.settled.get(c).value, { result: "c" });
  });

  await t.test("diamond A→B, A→C, B+C→D is a join point that fires with both values", () => {
    const a = new MockNode("a");
    const b = new MockNode("b");
    const c = new MockNode("c");
    const d = new MockNode("d", [], (inputs) => ({ received: Object.keys(inputs) }));

    a.next = [b, c];
    b.next = [d];
    c.next = [d];

    const graph = { nodes: [a, b, c, d], outputs: [d] };
    const result = executeGraph(graph);

    assert.equal(result.settled.get(d).status, "settled");
    // D should have both B and C in inputs
    assert.deepEqual(result.settled.get(d).value.received.sort(), ["b", "c"]);
  });

  await t.test("node that throws is marked failed, not propagated", () => {
    const a = new MockNode("a");
    const b = new MockNode("b", [], () => {
      throw new Error("b failed");
    });
    a.next = [b];

    const graph = { nodes: [a, b], outputs: [b] };
    const result = executeGraph(graph);

    assert.equal(result.settled.get(b).status, "failed");
    assert.equal(result.settled.get(b).error, "b failed");
  });

  await t.test("child of failed node is marked failed without calling execute", () => {
    let cExecuted = false;
    const a = new MockNode("a");
    const b = new MockNode("b", [], () => {
      throw new Error("b failed");
    });
    const c = new MockNode("c", [], () => {
      cExecuted = true;
      return { result: "c" };
    });

    a.next = [b];
    b.next = [c];

    const graph = { nodes: [a, b, c], outputs: [c] };
    const result = executeGraph(graph);

    assert.equal(result.settled.get(c).status, "failed");
    assert.equal(result.settled.get(c).error, "dependency failed");
    assert.equal(cExecuted, false);
  });

  await t.test("throws on duplicate node name", () => {
    const a = new MockNode("same");
    const b = new MockNode("same");

    const graph = { nodes: [a, b], outputs: [a, b] };

    assert.throws(() => executeGraph(graph), /Duplicate node name/);
  });

  await t.test("join point with one failed parent is marked failed", () => {
    const a = new MockNode("a");
    const b = new MockNode("b", [], () => {
      throw new Error("b failed");
    });
    const c = new MockNode("c");
    const d = new MockNode("d", [], () => ({ result: "d" }));

    a.next = [b];
    b.next = [d];
    c.next = [d];

    const graph = { nodes: [a, b, c, d], outputs: [d] };
    const result = executeGraph(graph);

    assert.equal(result.settled.get(d).status, "failed");
    assert.equal(result.settled.get(d).error, "dependency failed");
  });

  await t.test("parent node reference is accessible in inputs", () => {
    let parentNodeRef;
    const a = new MockNode("a", [], () => ({ data: "from-a" }));
    const b = new MockNode("b", [], (inputs) => {
      parentNodeRef = inputs["a"].node;
      return { result: "b" };
    });
    a.next = [b];

    const graph = { nodes: [a, b], outputs: [b] };
    executeGraph(graph);

    assert.equal(parentNodeRef, a);
    assert.equal(parentNodeRef.name, "a");
  });
});
