const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getResolverByCode,
  registerResolver,
} = require("../dist/ts/core/index.js");

function createResolver(name) {
  return {
    buildRuntimePlan() {
      return { nodes: [], routeClass: "", routePath: "", routeState: {} };
    },
    canHandle() {
      return true;
    },
    code: name,
    describe() {
      return name;
    },
    name,
    routingDescription: "",
    routingLabel: name,
    sourceName: name,
  };
}

test("resolver registry normalizes lookup keys and rejects duplicate names", () => {
  const registry = {};
  const yahoo = createResolver("YAHOO");

  assert.equal(registerResolver(registry, yahoo), yahoo);
  assert.equal(getResolverByCode(registry, "yahoo"), yahoo);
  assert.equal(getResolverByCode(registry, "missing"), null);

  assert.throws(
    () => registerResolver(registry, createResolver("YAHOO")),
    /already registered to a different resolver/,
  );
});
