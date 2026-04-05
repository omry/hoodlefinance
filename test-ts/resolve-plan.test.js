const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  RequestInput,
  buildResolvePlan,
  classifyTickerJob,
  createDefaultResolvePlanBuilder,
} = require("../dist/ts/core/index.js");

function createRequestInput({
  attribute = "price",
  attributeType = "quote",
  classification = "equity",
  identifier = "GOOG",
  infoMode = "",
  sourceOverride = "",
  ticker = "GOOG",
} = {}) {
  return new RequestInput({
    attribute,
    attributeRequest: {
      baseAttribute: attributeType === "isin" ? "isin" : "price",
      outputCode: "",
      rawAttribute: attribute,
      wantsOutputCurrency: false,
    },
    attributeType,
    classification,
    fxPair:
      classification === "fx"
        ? {
            baseCanonicalCode: "EUR",
            quoteCanonicalCode: "USD",
            yahooChartSymbol: "EURUSD=X",
          }
        : null,
    identifier,
    infoMode,
    sourceOverride,
    ticker,
    upperTicker: ticker.toUpperCase(),
  });
}

function createPlan(name, routePath = name) {
  return {
    buildRuntimePlan() {
      return { nodes: [], routeClass: name, routePath, routeState: {} };
    },
    canHandle() {
      return true;
    },
    code: name,
    describe() {
      return routePath;
    },
    getNodesForRequest() {
      return [];
    },
    isRoutingNode: false,
    name,
    routingDescription: "",
    routingLabel: name,
    sourceName: name,
  };
}

function createResolvedRequest() {
  return {
    input: {
      attribute: "price",
      identifier: "GOOG",
    },
    requestType: "equity",
    symbol: "GOOG",
    yahooSymbol: "GOOG",
  };
}

function createFactoryMaterializer() {
  const equityPlan = createPlan("EQUITY", "TICKER -> YAHOO");
  equityPlan.canHandle = (request) =>
    String((request && request.classification) || "")
      .trim()
      .toLowerCase() === "equity";

  const fxPlan = createPlan("FX", "GOOGLE-FX");
  fxPlan.canHandle = (request) =>
    String((request && request.classification) || "")
      .trim()
      .toLowerCase() === "fx";

  const identifierPlan = createPlan("IDENTIFIER:ISIN", "YAHOO-ISIN");
  identifierPlan.canHandle = (request) =>
    String((request && request.classification) || "")
      .trim()
      .toLowerCase() === "isin";

  const defaultAttributeRoot = createPlan("DEFAULT-ATTRIBUTE", "");
  defaultAttributeRoot.isRoutingNode = true;
  defaultAttributeRoot.nodes = [equityPlan, fxPlan];
  defaultAttributeRoot.getNodesForRequest = function getNodesForRequest() {
    return this.nodes || [];
  };

  const identifierRoot = createPlan("IDENTIFIER-ROOT", "");
  identifierRoot.isRoutingNode = true;
  identifierRoot.nodes = [identifierPlan];
  identifierRoot.getNodesForRequest = function getNodesForRequest() {
    return this.nodes || [];
  };

  return function materializePlanFromSpec(code) {
    if (code === "DEFAULT-ATTRIBUTE") {
      return defaultAttributeRoot;
    }

    if (code === "IDENTIFIER-ROOT") {
      return identifierRoot;
    }

    throw new Error(`Unexpected spec ${code}`);
  };
}

function createDeps(overrides = {}) {
  return {
    buildForcedAttributePlanForResolvedRequest() {
      return createPlan("FORCED-YAHOO", "YAHOO");
    },
    buildIdentifierResolutionPlan() {
      return createPlan("IDENTIFIER", "IDENTIFIER:ISIN -> YAHOO-ISIN");
    },
    buildQuoteRoutePlanForResolvedRequest() {
      return createPlan("QUOTE", "EQUITY -> TICKER -> YAHOO");
    },
    buildRepresentativeForcedAttributeRequest() {
      return createResolvedRequest();
    },
    buildSourceOverrideUnavailableError(sourceOverride) {
      return new Error(
        `"@${sourceOverride}" is not available for this request.`,
      );
    },
    createRequestInput(identifier, attribute) {
      return createRequestInput({ attribute, identifier, ticker: identifier });
    },
    listSupportedSourcesForRequest() {
      return "YAHOO, IBKR";
    },
    resolveIdentifierDirect() {
      return createResolvedRequest();
    },
    validateNonQuoteSourceOverride() {},
    ...overrides,
  };
}

test("buildResolvePlan returns a direct attribute plan when the identifier resolves immediately", () => {
  const input = createRequestInput();
  const plan = buildResolvePlan(input, createDeps());

  assert.equal(plan.debugValue, "");
  assert.equal(plan.resolvedRequest.requestType, "equity");
  assert.equal(plan.plannedRoute, "EQUITY -> TICKER -> YAHOO");
  assert.equal(
    plan.attributePlan.describe(plan.resolvedRequest),
    "EQUITY -> TICKER -> YAHOO",
  );
});

test("buildResolvePlan returns source-list and source-name debug views", () => {
  const deps = createDeps();

  const sourceListPlan = buildResolvePlan(
    createRequestInput({ infoMode: "source-list", ticker: "GOOG" }),
    deps,
  );
  assert.equal(sourceListPlan.debugValue, "YAHOO, IBKR");
  assert.equal(sourceListPlan.plannedRoute, "EQUITY -> TICKER -> YAHOO");

  const sourceNamePlan = buildResolvePlan(
    createRequestInput({ infoMode: "source-name", ticker: "GOOG" }),
    deps,
  );
  assert.equal(sourceNamePlan.debugValue, "EQUITY -> TICKER -> YAHOO");
});

test("buildResolvePlan falls back to the identifier plan when direct resolution misses", () => {
  const deps = createDeps({
    resolveIdentifierDirect() {
      return null;
    },
  });
  const input = createRequestInput({
    identifier: "US02079K1079",
    ticker: "US02079K1079",
  });
  const plan = buildResolvePlan(input, deps);

  assert.equal(plan.resolvedRequest, null);
  assert.equal(
    plan.identifierPlan.describe(input),
    "IDENTIFIER:ISIN -> YAHOO-ISIN",
  );
  assert.equal(
    plan
      .buildAttributePlan(createResolvedRequest())
      .describe(createResolvedRequest()),
    "EQUITY -> TICKER -> YAHOO",
  );
});

test("classifyTickerJob returns either debug plans or runtime plans from the resolve plan", () => {
  const deps = createDeps();

  assert.deepEqual(classifyTickerJob("GOOG", "price", deps), {
    nodes: [],
    routeClass: "QUOTE",
    routePath: "EQUITY -> TICKER -> YAHOO",
    routeState: {},
  });

  assert.deepEqual(
    classifyTickerJob(
      "GOOG",
      "price",
      createDeps({
        resolveIdentifierDirect() {
          return null;
        },
      }),
    ),
    {
      nodes: [],
      routeClass: "IDENTIFIER",
      routePath: "IDENTIFIER:ISIN -> YAHOO-ISIN",
      routeState: {},
    },
  );
});

test("createDefaultResolvePlanBuilder packages the core resolve-plan wiring", () => {
  const buildResolvePlanBuilder = createDefaultResolvePlanBuilder({
    directIdentifierResolver: new DirectIdentifierResolver(),
    materializePlanFromSpec: createFactoryMaterializer(),
  });

  const equityPlan = buildResolvePlanBuilder(
    createRequestInput({ ticker: "GOOG" }),
  );
  assert.equal(equityPlan.debugValue, "");
  assert.equal(equityPlan.plannedRoute, "EQUITY -> TICKER -> YAHOO");
  assert.equal(
    equityPlan.attributePlan.describe(equityPlan.resolvedRequest),
    "EQUITY -> TICKER -> YAHOO",
  );

  const fxPlan = buildResolvePlanBuilder(
    createRequestInput({
      classification: "fx",
      identifier: "EURUSD",
      ticker: "EURUSD",
    }),
  );
  assert.equal(fxPlan.debugValue, "");
  assert.equal(fxPlan.plannedRoute, "FX -> GOOGLE-FX");
  assert.equal(
    fxPlan.attributePlan.describe(fxPlan.resolvedRequest),
    "FX -> GOOGLE-FX",
  );

  const isinPlan = buildResolvePlanBuilder(
    createRequestInput({
      identifier: "US02079K1079",
      ticker: "US02079K1079",
    }),
  );
  assert.equal(isinPlan.resolvedRequest, null);
  assert.equal(
    isinPlan.identifierPlan.describe(isinPlan.requestInput),
    "YAHOO-ISIN",
  );
});
