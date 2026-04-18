// Tests ResolveFlow end-to-end: DAG instantiation, plan routing nodes
// (SwitchPlan, FirstSuccessPlan, StepPlan), and full attribute resolution traces.
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  EquityAttributeExtractResolver,
  FirstSuccessPlan,
  FirstSuccessReceiver,
  FxAttributeExtractResolver,
  GoogleFxResolver,
  LocalFxResolver,
  LonIsinResolver,
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
  getRoutingTableRows,
  ResolveFlow,
} = require("../dist/ts/core/index.js");
const { createRuntimePlanLookup } = require("./runtime-plan-fixtures.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

function createResolverMaterializationDependencies() {
  return {
    resolverClassesByName: {
      EquityAttributeExtractResolver,
      FirstSuccessReceiver,
      FxAttributeExtractResolver,
      GoogleFxResolver,
      LocalFxResolver,
      LonIsinResolver,
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

function buildTypedAttributePlan(runtimeLookup, requestInput) {
  const outcome = new DirectIdentifierResolver("DIRECT-IDENTIFIER").resolve(
    requestInput,
  );

  assert.equal(outcome.status, "success");

  return {
    attributePlan: buildQuoteRoutePlanForResolvedRequest(requestInput, outcome.value, {
      getPlanNodeByCode: runtimeLookup.getPlanNode,
    }),
    resolvedRequest: outcome.value,
  };
}

test("getRoutingTableRows classifies example tickers correctly", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
  });

  const rootNode = runtimeLookup.getNode("ROOT");
  const deps = {
    classifyRequest(rawInput) {
      const outcome = rootNode.resolve(rawInput);
      if (outcome.status !== "success") throw new Error(outcome.error);
      return outcome.value;
    },
  };

  const rows = getRoutingTableRows(deps);
  const findRow = (example) => rows.find(r => r.example === example);

  assert.equal(findRow("GOOG").classification, "equity");
  assert.equal(findRow("EURUSD").classification, "fx");
  assert.equal(findRow("USDUSD").classification, "fx");
  assert.equal(findRow("PSE:BDO").classification, "equity");
});

test("integrated mode always follows the default PSE quote branch", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(v),
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

  assert.equal(plan.attributePlan.name, "ATTRIBUTE:EQUITY");
  assert.equal(
    plan.attributePlan.describe(plan.resolvedRequest),
    "ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER",
  );
});

test("integrated routing errors on ambiguous default attribute plans", () => {
  // Force ambiguity by adding a resolver that handles everything
  const ambiguousSpec = {
    "AMBIGUOUS-EXTRA": {
      id: "AMBIGUOUS-EXTRA",
      next: ["YAHOO-QUOTE"],
      type: "FirstSuccessPlan",
    },
  };

  // We need to inject this into the ATTRIBUTE node codes
  const modifiedSpecs = JSON.parse(JSON.stringify(DagPlan));
  modifiedSpecs["ATTRIBUTE"].next.push("AMBIGUOUS-EXTRA");
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
    /Ambiguous default attribute route for classification "equity": ATTRIBUTE:EQUITY, AMBIGUOUS-EXTRA\./
  );
});
