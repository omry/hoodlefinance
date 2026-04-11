const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  RawRequestInput,
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
    getRoutingNodeKind() {
      return "leaf";
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

function classifyRawRequestInput(input) {
  const rawIdentifier = String(input.identifier || "").trim();
  const infoMode = rawIdentifier.endsWith("@")
    ? "source-list"
    : rawIdentifier.endsWith("@?")
      ? "source-name"
      : "";
  const normalizedIdentifier = infoMode
    ? rawIdentifier.replace(/@\??$/, "")
    : rawIdentifier;
  const sourceOverrideMatch = normalizedIdentifier.match(/^(.*)@([^@]+)$/);
  const ticker = sourceOverrideMatch ? sourceOverrideMatch[1] : normalizedIdentifier;
  const sourceOverride = sourceOverrideMatch ? sourceOverrideMatch[2] : "";
  const classification =
    ticker === "EURUSD" || ticker === "USDUSD"
      ? "fx"
      : /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(ticker)
        ? "isin"
        : "equity";

  return createRequestInput({
    attribute: input.attribute,
    classification,
    identifier: rawIdentifier,
    infoMode,
    sourceOverride,
    ticker,
  });
}

function createPlanNodeLookupFactory() {
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

  const identifierPlan = createPlan("IDENTIFIER:ISIN", "ISIN:YAHOO");
  identifierPlan.canHandle = (request) =>
    String((request && request.classification) || "")
      .trim()
      .toLowerCase() === "isin";

  const defaultAttributeRoot = createPlan("DEFAULT-ATTRIBUTE", "");
  defaultAttributeRoot.isRoutingNode = true;
  defaultAttributeRoot.getRoutingNodeKind = () => "switch";
  defaultAttributeRoot.nodes = [equityPlan, fxPlan];
  defaultAttributeRoot.getNodesForRequest = function getNodesForRequest() {
    return this.nodes || [];
  };

  const identifierRoot = createPlan("IDENTIFIER-ROOT", "");
  identifierRoot.isRoutingNode = true;
  identifierRoot.getRoutingNodeKind = () => "switch";
  identifierRoot.nodes = [identifierPlan];
  identifierRoot.getNodesForRequest = function getNodesForRequest() {
    return this.nodes || [];
  };

  const rootNode = createPlan("ROOT", "ROOT");
  rootNode.resolve = function resolve(request) {
    if (request instanceof RequestInput) {
      return {
        elapsedMs: 0,
        status: "success",
        value: request,
      };
    }

    return {
      elapsedMs: 0,
      status: "success",
      value: classifyRawRequestInput(request),
    };
  };

  return {
    getPlanNodeByCode(code) {
    if (code === "DEFAULT-ATTRIBUTE") {
      return defaultAttributeRoot;
    }

    if (code === "IDENTIFIER-ROOT") {
      return identifierRoot;
    }

    throw new Error(`Unexpected spec ${code}`);
    },
    getRootNode() {
      return rootNode;
    },
  };
}

function createDeps(overrides = {}) {
  return {
    buildForcedAttributePlanForResolvedRequest() {
      return createPlan("FORCED-YAHOO", "YAHOO");
    },
    buildIdentifierResolutionPlan() {
      return createPlan("IDENTIFIER", "IDENTIFIER:ISIN -> ISIN:YAHOO");
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
    enterRequestInput(input) {
      if (input instanceof RequestInput) {
        return input;
      }

      return classifyRawRequestInput(input);
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
  const input = new RawRequestInput("GOOG", "price");
  const plan = buildResolvePlan(input, createDeps());

  assert.equal(plan.debugValue, "");
  assert.equal(plan.resolvedRequest.requestType, "equity");
  assert.equal(plan.plannedRoute, "EQUITY -> TICKER -> YAHOO");
  assert.equal(
    plan.attributePlan.describe(plan.resolvedRequest),
    "EQUITY -> TICKER -> YAHOO",
  );
});

test("buildResolvePlan preserves parent refs when wrapping a forced source selection", () => {
  const forcedLeaf = createPlan("YAHOO", "YAHOO");
  const parentPlan = createPlan("EQUITY", "EQUITY -> YAHOO");
  const defaultAttributeRoot = createPlan("DEFAULT-ATTRIBUTE", "");
  const rootNode = createPlan("ROOT", "ROOT");
  const refs = {
    getFxPlan() {
      return { marker: "fx-plan" };
    },
  };

  forcedLeaf.matchesSourceName = (source) =>
    String(source || "").trim().toUpperCase() === "YAHOO";
  parentPlan.canHandle = (request) =>
    String((request && request.classification) || "")
      .trim()
      .toLowerCase() === "equity";
  parentPlan.nodes = [forcedLeaf];
  parentPlan.refs = refs;
  defaultAttributeRoot.isRoutingNode = true;
  defaultAttributeRoot.getRoutingNodeKind = () => "switch";
  defaultAttributeRoot.nodes = [parentPlan];
  defaultAttributeRoot.getNodesForRequest = function getNodesForRequest() {
    return this.nodes || [];
  };
  rootNode.resolve = function resolve(_request) {
    return {
      elapsedMs: 0,
      status: "success",
      value: createRequestInput(),
    };
  };

  const buildResolvePlanBuilder = createDefaultResolvePlanBuilder({
    directIdentifierResolver: new DirectIdentifierResolver(),
    getRootNode() {
      return rootNode;
    },
    getPlanNodeByCode(code) {
      if (code === "DEFAULT-ATTRIBUTE") {
        return defaultAttributeRoot;
      }

      throw new Error(`Unexpected spec ${code}`);
    },
  });
  const plan = buildResolvePlanBuilder(
    new RawRequestInput("GOOG", "price"),
  );

  assert.equal(plan.attributePlan.refs, refs);
});

test("buildResolvePlan enters through the root graph for raw input", () => {
  let enterRequestInputCalls = 0;
  let resolveIdentifierDirectCalls = 0;
  const plan = buildResolvePlan(
    new RawRequestInput("GOOG", "price"),
    createDeps({
      enterRequestInput(input) {
        enterRequestInputCalls += 1;
        assert.equal(input instanceof RawRequestInput, true);

        return classifyRawRequestInput(input);
      },
      resolveIdentifierDirect(input) {
        resolveIdentifierDirectCalls += 1;
        assert.equal(input instanceof RequestInput, true);
        return createResolvedRequest();
      },
    }),
  );

  assert.equal(enterRequestInputCalls, 1);
  assert.equal(resolveIdentifierDirectCalls, 1);
  assert.equal(plan.requestInput.identifier, "GOOG");
  assert.equal(plan.requestInput.classification, "equity");
  assert.equal(plan.plannedRoute, "EQUITY -> TICKER -> YAHOO");
});

test("buildResolvePlan returns source-list and source-name debug views", () => {
  const deps = createDeps();

  const sourceListPlan = buildResolvePlan(
    new RawRequestInput("GOOG@", "price"),
    deps,
  );
  assert.equal(sourceListPlan.debugValue, "YAHOO, IBKR");
  assert.equal(sourceListPlan.plannedRoute, "EQUITY -> TICKER -> YAHOO");

  const sourceNamePlan = buildResolvePlan(
    new RawRequestInput("GOOG@?", "price"),
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
  const input = new RawRequestInput("US02079K1079", "price");
  const plan = buildResolvePlan(input, deps);

  assert.equal(plan.resolvedRequest, null);
  assert.equal(
    plan.identifierPlan.describe(plan.requestInput),
    "IDENTIFIER:ISIN -> ISIN:YAHOO",
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
      routePath: "IDENTIFIER:ISIN -> ISIN:YAHOO",
      routeState: {},
    },
  );
});

test("createDefaultResolvePlanBuilder packages the core resolve-plan wiring", () => {
  const runtimeLookup = createPlanNodeLookupFactory();
  const buildResolvePlanBuilder = createDefaultResolvePlanBuilder({
    directIdentifierResolver: new DirectIdentifierResolver(),
    getRootNode: runtimeLookup.getRootNode,
    getPlanNodeByCode: runtimeLookup.getPlanNodeByCode,
  });

  const equityPlan = buildResolvePlanBuilder(
    new RawRequestInput("GOOG", "price"),
  );
  assert.equal(equityPlan.debugValue, "");
  assert.equal(equityPlan.plannedRoute, "EQUITY -> TICKER -> YAHOO");
  assert.equal(
    equityPlan.attributePlan.describe(equityPlan.resolvedRequest),
    "EQUITY -> TICKER -> YAHOO",
  );

  const rawPlan = buildResolvePlanBuilder(new RawRequestInput("GOOG", "price"));
  assert.equal(rawPlan.requestInput.identifier, "GOOG");
  assert.equal(rawPlan.plannedRoute, "EQUITY -> TICKER -> YAHOO");

  const fxPlan = buildResolvePlanBuilder(new RawRequestInput("EURUSD", "price"));
  assert.equal(fxPlan.debugValue, "");
  assert.equal(fxPlan.plannedRoute, "FX -> GOOGLE-FX");
  assert.equal(
    fxPlan.attributePlan.describe(fxPlan.resolvedRequest),
    "FX -> GOOGLE-FX",
  );

  const isinPlan = buildResolvePlanBuilder(
    new RawRequestInput("US02079K1079", "price"),
  );
  assert.equal(isinPlan.resolvedRequest, null);
  assert.equal(
    isinPlan.identifierPlan.describe(isinPlan.requestInput),
    "ISIN:YAHOO",
  );
});
