const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getMaterializedResolverByCode,
  materializeResolversByCode,
} = require("../dist/ts/core/index.js");

class FakeResolver {
  constructor(code, label) {
    this.code = code;
    this.name = code;
    this.routingDescription = label;
    this.routingLabel = code;
    this.sourceName = code;
  }

  canHandle() {
    return true;
  }

  buildRuntimePlan() {
    return { nodes: [this], routeClass: this.name, routePath: this.name, routeState: {} };
  }

  describe() {
    return this.name;
  }

  static fromSpec(code, spec) {
    return new this(code, spec.options?.routingDescription || "");
  }
}

test("materializeResolversByCode instantiates and registers resolvers by class name", () => {
  const registry = materializeResolversByCode(
    {
      YAHOO: {
        options: { routingDescription: "Yahoo quote lookup" },
        resolverClass: "FakeResolver",
      },
    },
    {
      resolverClassesByName: {
        FakeResolver,
      },
    },
  );

  const resolver = getMaterializedResolverByCode(registry, "yahoo");
  assert.equal(resolver?.name, "YAHOO");
  assert.equal(resolver?.routingDescription, "Yahoo quote lookup");
});

test("materializeResolversByCode rejects unknown class names", () => {
  assert.throws(
    () =>
      materializeResolversByCode(
        {
          YAHOO: {
            resolverClass: "MissingResolver",
          },
        },
        {
          resolverClassesByName: {},
        },
      ),
    /Unknown resolver class "MissingResolver" for "YAHOO"\./,
  );
});
