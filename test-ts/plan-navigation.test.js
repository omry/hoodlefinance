const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestInput,
  findNamedResolver,
  matchesResolverName,
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
    getRoutingNodeKind() {
      return "leaf";
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
      getRoutingNodeKind() {
        return "switch";
      },
      isRoutingNode: true,
      name: "ROOT",
      nodes: [yahoo],
    },
    request,
  );

  assert.equal(resolved, yahoo);
});

test("resolveRoutingNode also unwraps linear step plans", () => {
  const request = createRequest();
  const classifier = createResolverNode("CLASSIFY-REQUEST");

  const resolved = resolveRoutingNode(
    {
      canHandle() {
        return true;
      },
      getNodesForRequest() {
        return [classifier];
      },
      getRoutingNodeKind() {
        return "step";
      },
      isRoutingNode: true,
      name: "ROOT",
      nodes: [classifier],
    },
    request,
  );

  assert.equal(resolved, classifier);
});

test("resolver node name matching and lookup search by name", () => {
  const request = createRequest();
  const yahoo = createResolverNode("YAHOO");
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
  };

  assert.equal(matchesResolverName(yahoo, "YAHOO"), true);
  assert.equal(matchesResolverName(yahoo, "yahoo finance"), false);
  assert.equal(findNamedResolver(root, "IBKR", request), ibkr);
  assert.equal(findNamedResolver(root, "YAHOO", request), yahoo);
  assert.equal(findNamedResolver(root, "MISSING", request), null);
});

test("findNamedResolver searches raw searchable children, not only selector-filtered matches", () => {
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

  assert.equal(findNamedResolver(root, "YAHOO", request), yahoo);
});
