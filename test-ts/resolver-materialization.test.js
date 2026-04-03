const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  FunctionValueResolver,
  RequestInput,
  createConcreteResolverMaterializationDependencies,
  getMaterializedResolverByCode,
  getRegisteredResolverByName,
  materializeResolversByCode,
} = require("../dist/ts/core/index.js");

class FakeResolver {
  constructor(code, label, name) {
    this.code = code;
    this.name = name || code;
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
    return new this(
      code,
      spec.options?.routingDescription || "",
      spec.options?.materializedName || code,
    );
  }
}

test("materializeResolversByCode instantiates and registers resolvers by class name", () => {
  const registry = materializeResolversByCode(
    {
      YAHOO: {
        options: {
          materializedName: "YAHOO-LOOKUP",
          routingDescription: "Yahoo quote lookup",
        },
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
  assert.equal(registry.byCode.YAHOO, resolver);
  assert.equal(getRegisteredResolverByName(registry.byName, "YAHOO-LOOKUP"), resolver);
  assert.equal(resolver?.name, "YAHOO-LOOKUP");
  assert.equal(registry.byCode.YAHOO?.routingDescription, "Yahoo quote lookup");
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

test("materializeResolversByCode can instantiate concrete resolvers with class-specific dependencies", () => {
  const registry = materializeResolversByCode(
    {
      DIRECT: {
        resolveFunctionRef: "DIRECT",
        resolverClass: "FunctionValueResolver",
      },
      "DIRECT-IDENTIFIER": {
        resolverClass: "DirectIdentifierResolver",
      },
    },
    createConcreteResolverMaterializationDependencies({
      resolveFunctionsByRef: {
        DIRECT(job) {
          return String(job.routeState.identifier || "").toUpperCase();
        },
      },
    }),
  );

  assert.equal(registry.byCode.DIRECT instanceof FunctionValueResolver, true);
  assert.equal(
    registry.byCode["DIRECT-IDENTIFIER"] instanceof DirectIdentifierResolver,
    true,
  );
  assert.equal(
    registry.byCode.DIRECT.executeBatch([{ routeState: { identifier: "goog" } }])[0].value,
    "GOOG",
  );

  const resolved = registry.byCode["DIRECT-IDENTIFIER"].resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "equity",
      fxPair: null,
      identifier: "GOOG",
      infoMode: "",
      sourceOverride: "",
      ticker: "GOOG",
      upperTicker: "GOOG",
    }),
  );

  assert.equal(resolved.status, "success");
  assert.equal(resolved.value.yahooSymbol, "GOOG");
});
