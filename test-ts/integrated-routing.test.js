const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  FirstSuccessPlan,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  RawRequestInput,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  DagPlan,
  RequestInput,
  buildQuoteRoutePlanForResolvedRequest,
  createDefaultResolvePlanBuilder,
  getRoutingTableRows,
  ResolveFlow,
} = require("../dist/ts/core/index.js");
const { createRuntimePlanLookup } = require("./runtime-plan-fixtures.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

function createResolverMaterializationDependencies() {
  return {
    resolverClassesByName: {
      DirectIdentifierResolver,
      GoogleFxResolver,
      LocalFxResolver,
      PSEEdgeResolver: PseEdgeResolver,
      PSEFramesResolver: PseFramesResolver,
      PseIsinMapResolver,
      RequestClassifierResolver,
      YahooIsinSearchResolver,
      YahooEquityQuoteResolver,
      YahooFxResolver,
      TradingviewFundResolver,
    },
    resolverServices: createStaticResolverServices(),
  };
}

function createIntegratedCompiledDag(planSpecsByCode = DagPlan) {
  return new ResolveFlow(planSpecsByCode, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });
}

function wrapSelectedResolverNode(node, parentPlan = null) {
  const wrappedName = String((node && node.name) || "").trim();
  const refs =
    parentPlan && parentPlan.refs
      ? parentPlan.refs
      : node && node.refs
        ? node.refs
        : null;
  const options = {
    routeClass(request) {
      return node && node.buildRuntimePlan
        ? node.buildRuntimePlan(request).routeClass
        : wrappedName;
    },
    routePath(request) {
      return node && node.buildRuntimePlan
        ? node.buildRuntimePlan(request).routePath
        : wrappedName;
    },
  };

  return refs
    ? new FirstSuccessPlan(wrappedName, [node], refs, options)
    : new FirstSuccessPlan(wrappedName, [node], options);
}

function buildTypedAttributePlan(runtimeLookup, requestInput) {
  const outcome = runtimeLookup.getNode("RESOLVED-IDENTIFIER").resolve(requestInput);

  assert.equal(outcome.status, "success");

  return {
    attributePlan: wrapSelectedResolverNode(
      buildQuoteRoutePlanForResolvedRequest(requestInput, outcome.value, {
        getPlanNodeByCode: runtimeLookup.getPlanNode,
      }),
    ),
    resolvedRequest: outcome.value,
  };
}

test("HOODLEFINANCE_ROUTES returns the routing table matching legacy integrated results", () => {
  createIntegratedCompiledDag();
  const runtimeLookup = createRuntimePlanLookup(DagPlan, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: runtimeLookup.getNode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode: runtimeLookup.getPlanNode,
  });

  const deps = {
    buildResolvePlan,
  };

  const rows = getRoutingTableRows(deps);
  const findRow = (example) => rows.find(r => r.example === example);

  // Partial match checks based on legacy test expectations
  // Partial match checks based on actual TS integrated results
  assert.equal(findRow("GOOG").route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(findRow("EURUSD").route, "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX");
  assert.equal(findRow("USDUSD").route, "DEFAULT-ATTRIBUTE:FX -> FX-IDENTITY");
  assert.equal(findRow("PSE:BDO").route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER");

  // Specific planned route check
  const googPlan = buildResolvePlan(new RawRequestInput("GOOG", "price"));
  assert.equal(googPlan.plannedRoute, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
});

test("integrated mode always follows the default PSE quote branch", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });
  const buildResolvePlan = createDefaultResolvePlanBuilder({
    directIdentifierResolver: runtimeLookup.getNode("RESOLVED-IDENTIFIER"),
    getPlanNodeByCode: runtimeLookup.getPlanNode,
  });
  const request = new RequestInput("PSE:BDO@PSE-FRAMES", "price", {
    looksLikeIsin: () => false,
    normalizeAttribute: (a) => a,
    parseAttributeRequest: (a) => ({}),
    parseFxTicker: () => null,
    parseTickerRequest: () => ({
      ticker: "PSE:BDO",
      infoMode: "source-list",
    }),
  });
  const plan = buildTypedAttributePlan(runtimeLookup, request);

  assert.equal(plan.attributePlan.name, "DEFAULT-ATTRIBUTE:EQUITY");
  assert.equal(
    plan.attributePlan.describe(plan.resolvedRequest),
    "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER",
  );
  assert.equal(
    buildResolvePlan(new RawRequestInput("PSE:BDO", "price")).plannedRoute,
    "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER",
  );
});

test("integrated routing errors on ambiguous default attribute plans", () => {
  // Force ambiguity by adding a resolver that handles everything
  const ambiguousSpec = {
    "AMBIGUOUS-EXTRA": {
      id: "AMBIGUOUS-EXTRA",
      next: ["YAHOO-QUOTE"],
      type: "AttributeResolutionPlan",
    },
  };

  // We need to inject this into the DEFAULT-ATTRIBUTE node codes
  const modifiedSpecs = JSON.parse(JSON.stringify(DagPlan));
  modifiedSpecs["DEFAULT-ATTRIBUTE"].next.push("AMBIGUOUS-EXTRA");
  modifiedSpecs["AMBIGUOUS-EXTRA"] = ambiguousSpec["AMBIGUOUS-EXTRA"];
  const runtimeLookup = createRuntimePlanLookup(modifiedSpecs, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });

  assert.throws(
    () =>
      buildTypedAttributePlan(
        runtimeLookup,
        new RequestInput("GOOG", "price", {
          looksLikeIsin: () => false,
          normalizeAttribute: (a) => a,
          parseAttributeRequest: (a) => ({}),
          parseFxTicker: () => null,
          parseTickerRequest: (t) => ({
            ticker: t,
            infoMode: "",
          }),
        }),
      ),
    /Ambiguous default attribute route for classification "equity": DEFAULT-ATTRIBUTE:EQUITY, AMBIGUOUS-EXTRA\./
  );
});
