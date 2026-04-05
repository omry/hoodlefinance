const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestInput,
  findNamedResolverNode,
  matchesResolverNodeName,
  resolveRoutingNode,
  selectSinglePlanNode,
} = require("../dist/ts/core/index.js");

function createRequest() {
  return new RequestInput({
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
  });
}

function createResolverNode(name, extra = {}) {
  return {
    canHandle() {
      return true;
    },
    buildRuntimePlan() {
      return { nodes: [], routeClass: "", routePath: "", routeState: {} };
    },
    code: name,
    describe() {
      return name;
    },
    name,
    routingDescription: "",
    routingLabel: name,
    sourceName: name,
    ...extra,
  };
}

test("selectSinglePlanNode handles single, missing, and ambiguous selections", () => {
  const request = createRequest();
  const yahoo = createResolverNode("YAHOO");

  assert.equal(
    selectSinglePlanNode(
      {
        getNodesForRequest() {
          return [yahoo];
        },
        name: "QUOTE",
      },
      request,
    ),
    yahoo,
  );

  assert.throws(
    () =>
      selectSinglePlanNode(
        {
          getNodesForRequest() {
            return [];
          },
          name: "QUOTE",
        },
        request,
      ),
    /matched no nodes/,
  );

  assert.throws(
    () =>
      selectSinglePlanNode(
        {
          getNodesForRequest() {
            return [createResolverNode("YAHOO"), createResolverNode("IBKR")];
          },
          name: "QUOTE",
        },
        request,
      ),
    /matched multiple nodes/,
  );
});

test("resolveRoutingNode unwraps routing plans until it reaches a concrete node", () => {
  const request = createRequest();
  const yahoo = createResolverNode("YAHOO");

  const resolved = resolveRoutingNode(
    {
      canHandle() {
        return true;
      },
      getNodesForRequest() {
        return [yahoo];
      },
      isRoutingNode: true,
      name: "ROOT",
      nodes: [yahoo],
    },
    request,
  );

  assert.equal(resolved, yahoo);
});

test("resolver node name matching and lookup search by both name and source name", () => {
  const request = createRequest();
  const yahoo = createResolverNode("YAHOO", { sourceName: "Yahoo Finance" });
  const ibkr = createResolverNode("IBKR");

  const root = {
    canHandle() {
      return true;
    },
    getNodesForRequest() {
      return [yahoo, ibkr];
    },
    isRoutingNode: false,
    name: "ROOT",
    nodes: [yahoo, ibkr],
    routingDescription: "",
    routingLabel: "ROOT",
    sourceName: "ROOT",
  };

  assert.equal(matchesResolverNodeName(yahoo, "YAHOO"), true);
  assert.equal(matchesResolverNodeName(yahoo, "yahoo finance"), true);
  assert.equal(findNamedResolverNode(root, "IBKR", request), ibkr);
  assert.equal(findNamedResolverNode(root, "YAHOO FINANCE", request), yahoo);
  assert.equal(findNamedResolverNode(root, "MISSING", request), null);
});

test("findNamedResolverNode searches raw searchable children, not only selector-filtered matches", () => {
  const request = createRequest();
  const yahoo = createResolverNode("YAHOO");
  const ibkr = createResolverNode("IBKR");

  const root = {
    canHandle() {
      return true;
    },
    getNodesForRequest() {
      return [ibkr];
    },
    isRoutingNode: false,
    name: "ROOT",
    nodes: [yahoo, ibkr],
    routingDescription: "",
    routingLabel: "ROOT",
    sourceName: "ROOT",
  };

  assert.equal(findNamedResolverNode(root, "YAHOO", request), yahoo);
});
