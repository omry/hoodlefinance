// Tests ResolveFlow end-to-end: DAG instantiation, plan routing nodes
// (SwitchPlan, FirstSuccessPlan, StepPlan), and full attribute resolution traces.
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  EquityAttributeExtractResolver,
  EquityAttributeResolutionPlan,
  FirstSuccessJunction,
  FirstSuccessReceiver,
  FxAttributeExtractResolver,
  FxAttributeResolutionPlan,
  GoogleFxResolver,
  LocalFxResolver,
  LonIsinResolver,
  NodeFactoryRegistry,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  PseQuoteResolutionPlan,
  RequestClassifierResolver,
  RawRequestInput,
  RoutingPlan,
  StepJunction,
  TickerQuoteResolutionPlan,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  DagPlan,
  RequestInput,
  getRoutingTableRows,
  ResolveFlow,
} = require("../dist/ts/core/index.js");
const { createRuntimePlanLookup } = require("./runtime-plan-fixtures.js");
const {
  createStaticResolverServices,
} = require("./resolver-service-fixtures.js");

function createResolverRegistry() {
  return new NodeFactoryRegistry()
    .registerLeaf("EquityAttributeExtractResolver", EquityAttributeExtractResolver)
    .registerLeaf("FirstSuccessReceiver", FirstSuccessReceiver)
    .registerLeaf("FxAttributeExtractResolver", FxAttributeExtractResolver)
    .registerLeaf("GoogleFxResolver", GoogleFxResolver)
    .registerLeaf("LocalFxResolver", LocalFxResolver)
    .registerLeaf("LonIsinResolver", LonIsinResolver)
    .registerLeaf("PSEEdgeResolver", PseEdgeResolver)
    .registerLeaf("PSEFramesResolver", PseFramesResolver)
    .registerLeaf("PseIsinMapResolver", PseIsinMapResolver)
    .registerLeaf("RequestClassifierResolver", RequestClassifierResolver)
    .registerLeaf("YahooIsinSearchResolver", YahooIsinSearchResolver)
    .registerLeaf("YahooEquityQuoteResolver", YahooEquityQuoteResolver)
    .registerLeaf("YahooFxResolver", YahooFxResolver)
    .registerLeaf("TradingviewFundResolver", TradingviewFundResolver)
    .registerPlan("EquityAttributeResolutionPlan", EquityAttributeResolutionPlan)
    .registerPlan("FirstSuccessPlan", FirstSuccessJunction)
    .registerPlan("FxAttributeResolutionPlan", FxAttributeResolutionPlan)
    .registerPlan("PseQuoteResolutionPlan", PseQuoteResolutionPlan)
    .registerPlan("RoutingPlan", RoutingPlan)
    .registerPlan("StepPlan", StepJunction)
    .registerPlan("TickerQuoteResolutionPlan", TickerQuoteResolutionPlan);
}

function buildTypedAttributePlan(runtimeLookup, requestInput) {
  const outcome = new DirectIdentifierResolver("DIRECT-IDENTIFIER").execute(
    requestInput,
  );

  assert.equal(outcome.status, "success");
  const attributeRoot = runtimeLookup.getPlanNode("ATTRIBUTE");
  const candidatePlans = (attributeRoot.nodes || []).filter(
    (plan) => !plan.canHandle || plan.canHandle(outcome.value),
  );

  if (!candidatePlans.length) {
    throw new Error("No attribute route is available for this request.");
  }

  if (candidatePlans.length > 1) {
    throw new Error(
      `Ambiguous default attribute route for classification "${String(outcome.value.classification || "").toLowerCase()}": ${candidatePlans.map((plan) => plan.name).join(", ")}.`,
    );
  }

  return {
    attributePlan: candidatePlans[0],
    resolvedRequest: outcome.value,
  };
}

test("getRoutingTableRows classifies example tickers correctly", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, createResolverRegistry(), createStaticResolverServices());

  const rootNode = runtimeLookup.getNode("ROOT");
  const deps = {
    classifyRequest(rawInput) {
      const outcome = rootNode.execute(rawInput);
      if (outcome.status !== "success") throw new Error(outcome.error);
      return outcome.value;
    },
  };

  const rows = getRoutingTableRows(deps);
  const findRow = (example) => rows.find((r) => r.example === example);

  assert.equal(findRow("GOOG").classification, "equity");
  assert.equal(findRow("EURUSD").classification, "fx");
  assert.equal(findRow("USDUSD").classification, "fx");
  assert.equal(findRow("PSE:BDO").classification, "equity");
});

test("integrated mode always follows the default PSE quote branch", () => {
  const runtimeLookup = createRuntimePlanLookup(DagPlan, createResolverRegistry(), createStaticResolverServices());
  const request = new RequestInput({
    attribute: "price",
    attributeRequest: {
      baseAttribute: "price",
      outputCode: "",
      rawAttribute: "price",
      wantsOutputCurrency: false,
    },
    attributeType: "quote",
    fxPair: null,
    identifier: "PSE:BDO@PSE-FRAMES",
    infoMode: "source-list",
    ticker: "PSE:BDO",
  });
  const plan = buildTypedAttributePlan(runtimeLookup, request);

  assert.equal(plan.attributePlan.name, "ATTRIBUTE:EQUITY");
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
  const runtimeLookup = createRuntimePlanLookup(modifiedSpecs, createResolverRegistry(), createStaticResolverServices());

  assert.throws(
    () =>
      buildTypedAttributePlan(
        runtimeLookup,
        new RequestInput({
          attribute: "price",
          attributeRequest: {
            baseAttribute: "price",
            outputCode: "",
            rawAttribute: "price",
            wantsOutputCurrency: false,
          },
          attributeType: "quote",
          fxPair: null,
          identifier: "GOOG",
          infoMode: "",
          ticker: "GOOG",
        }),
      ),
    /Ambiguous default attribute route for classification "equity": ATTRIBUTE:EQUITY, AMBIGUOUS-EXTRA\./,
  );
});
