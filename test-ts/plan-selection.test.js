const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestInput,
  buildAmbiguousDefaultAttributeRouteError,
  buildDefaultAttributePlanForResolvedRequest,
  buildIdentifierResolutionPlan,
  buildQuoteRoutePlanForResolvedRequest,
} = require("../dist/ts/core/index.js");

function createRequestInput(overrides = {}) {
  return new RequestInput({
    attribute: overrides.attribute || "price",
    attributeRequest: {
      baseAttribute: overrides.attributeType === "isin" ? "isin" : "price",
      outputCode: "",
      rawAttribute: overrides.attribute || "price",
      wantsOutputCurrency: false,
    },
    attributeType: overrides.attributeType || "quote",
    fxPair: null,
    identifier: overrides.identifier || "GOOG",
    infoMode: "",
    ticker: overrides.ticker || overrides.identifier || "GOOG",
  });
}

function createResolvedRequest(overrides = {}) {
  return {
    classification: overrides.classification || "equity",
    input: {
      attribute: overrides.attribute || "price",
      identifier: overrides.identifier || "GOOG",
    },
    requestType: overrides.requestType || "equity",
    symbol: overrides.symbol || "GOOG",
    yahooSymbol: overrides.yahooSymbol || "GOOG",
  };
}

function createNode(name, extra = {}) {
  return {
    buildRuntimePlan() {
      return { nodes: [], routeClass: name, routePath: name, routeState: {} };
    },
    canHandle() {
      return true;
    },
    code: name,
    describe() {
      return name;
    },
    getNodesForRequest() {
      return this.nodes || [];
    },
    getRoutingNodeKind() {
      return extra.isRoutingNode ? "switch" : "leaf";
    },
    isRoutingNode: extra.isRoutingNode === true,
    name,
    nodes: extra.nodes || [],
    routingDescription: "",
    routingLabel: extra.routingLabel || name,
    sourceName: extra.sourceName || name,
  };
}

function createDeps() {
  const yahoo = createNode("YAHOO");
  const ibkr = createNode("IBKR");
  const identifierLeaf = createNode("IDENTIFIER-LEAF", {
    nodes: [yahoo, ibkr],
  });
  const identifierRoot = createNode("IDENTIFIER-ROOT", {
    isRoutingNode: true,
    nodes: [identifierLeaf],
  });
  const defaultLeaf = createNode("QUOTE-DEFAULT", { nodes: [yahoo] });
  const defaultRoot = createNode("ATTRIBUTE", {
    isRoutingNode: true,
    nodes: [defaultLeaf],
  });

  return {
    buildSelectedIdentifierPlan(resolverOrPlan) {
      return createNode(`IDENTIFIER:${resolverOrPlan.name}`);
    },
    extractIsinFromRequestInput(input) {
      const ticker = String(input.ticker || "");
      return ticker.startsWith("US") ? ticker.toUpperCase() : "";
    },
    listAllDefaultAttributePlans() {
      return [defaultLeaf];
    },
    getPlanNodeByCode(code) {
      if (code === "IDENTIFIER:ISIN") {
        return identifierRoot;
      }

      if (code === "ATTRIBUTE") {
        return defaultRoot;
      }

      throw new Error(`Unexpected spec ${code}`);
    },
  };
}

test("plan-selection error helpers keep the current ambiguity wording", () => {
  assert.equal(
    buildAmbiguousDefaultAttributeRouteError(
      createResolvedRequest({ classification: "equity" }),
      [
        { name: "PSE", routingLabel: "PSE" },
        { name: "TICKER", routingLabel: "TICKER" },
      ],
    ).message,
    'Ambiguous default attribute route for classification "equity": PSE, TICKER.',
  );
});

test("buildIdentifierResolutionPlan handles absent and direct identifier resolution", () => {
  const deps = createDeps();

  assert.equal(
    buildIdentifierResolutionPlan(createRequestInput({ ticker: "GOOG" }), deps),
    null,
  );

  assert.equal(
    buildIdentifierResolutionPlan(
      createRequestInput({
        identifier: "US02079K1079",
        ticker: "US02079K1079",
      }),
      deps,
    ).name,
    "IDENTIFIER-LEAF",
  );
});

test("buildDefault and quote attribute helpers keep the planner selection behavior", () => {
  const deps = createDeps();
  const requestInput = createRequestInput();
  const resolvedRequest = createResolvedRequest();

  assert.equal(
    buildDefaultAttributePlanForResolvedRequest(resolvedRequest, deps).name,
    "QUOTE-DEFAULT",
  );
  assert.equal(
    buildQuoteRoutePlanForResolvedRequest(requestInput, resolvedRequest, deps)
      .name,
    "QUOTE-DEFAULT",
  );
});
