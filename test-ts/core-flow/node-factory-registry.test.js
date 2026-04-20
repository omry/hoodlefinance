const assert = require("node:assert/strict");
const test = require("node:test");

const {
  NodeFactoryRegistry,
  FlowNode,
  FlowJunction,
} = require("../../dist/ts/core/index.js");

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

class LeafA extends FlowNode {}
class LeafB extends FlowNode {}

class PlanA extends FlowJunction {
  constructor(code, nodes, options) {
    super(code, nodes, options);
  }
}

class NotAResolver {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("register accepts a FlowNode subclass", () => {
  const registry = new NodeFactoryRegistry();
  registry.register("leaf-a", LeafA);
  assert.equal(registry.get("leaf-a"), LeafA);
});

test("register rejects a class not extending FlowNode", () => {
  const registry = new NodeFactoryRegistry();
  assert.throws(
    () => registry.register("bad", NotAResolver),
    /must extend FlowNode/,
  );
});

test("get returns undefined for unknown name", () => {
  const registry = new NodeFactoryRegistry();
  assert.equal(registry.get("unknown"), undefined);
});

test("registerLeaf stores the constructor", () => {
  const registry = new NodeFactoryRegistry();
  registry.registerLeaf("leaf-b", LeafB);
  assert.equal(registry.get("leaf-b"), LeafB);
});

test("registerPlan accepts a FlowJunction subclass", () => {
  const registry = new NodeFactoryRegistry();
  registry.registerPlan("plan-a", PlanA);
  assert.equal(registry.get("plan-a"), PlanA);
});

test("registerPlan rejects a plain FlowNode subclass", () => {
  const registry = new NodeFactoryRegistry();
  assert.throws(
    () => registry.registerPlan("leaf-a", LeafA),
    /must extend FlowJunction/,
  );
});

test("register is chainable", () => {
  const registry = new NodeFactoryRegistry();
  const result = registry.register("leaf-a", LeafA).register("leaf-b", LeafB);
  assert.equal(result, registry);
  assert.equal(registry.get("leaf-a"), LeafA);
  assert.equal(registry.get("leaf-b"), LeafB);
});

test("returned constructor can instantiate a leaf", () => {
  const registry = new NodeFactoryRegistry();
  registry.registerLeaf("leaf-a", LeafA);
  const Ctor = registry.get("leaf-a");
  const instance = new Ctor("my-code");
  assert.ok(instance instanceof FlowNode);
  assert.equal(instance.id, "my-code");
});

test("returned constructor can instantiate a plan", () => {
  const registry = new NodeFactoryRegistry();
  registry.registerPlan("plan-a", PlanA);
  const Ctor = registry.get("plan-a");
  const instance = new Ctor("plan-code", [], {});
  assert.ok(instance instanceof FlowJunction);
  assert.equal(instance.id, "plan-code");
});
