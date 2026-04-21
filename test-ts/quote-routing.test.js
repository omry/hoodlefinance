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
  FanOutJunction,
  TerminalCollectorNode,
  TickerQuoteResolutionPlan,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  DagPlan,
  RequestInput,
  ResolveFlow,
} = require("../dist/ts/core/index.js");
const { createRuntimePlanLookup } = require("./runtime-plan-fixtures.js");
const {
  createStaticResolverServices,
} = require("./resolver-service-fixtures.js");

function createResolverRegistry() {
  return new NodeFactoryRegistry()
    .register("EquityAttributeExtractResolver", EquityAttributeExtractResolver)
    .register("FirstSuccessReceiver", FirstSuccessReceiver)
    .register("FxAttributeExtractResolver", FxAttributeExtractResolver)
    .register("GoogleFxResolver", GoogleFxResolver)
    .register("LocalFxResolver", LocalFxResolver)
    .register("LonIsinResolver", LonIsinResolver)
    .register("PSEEdgeResolver", PseEdgeResolver)
    .register("PSEFramesResolver", PseFramesResolver)
    .register("PseIsinMapResolver", PseIsinMapResolver)
    .register("RequestClassifierResolver", RequestClassifierResolver)
    .register("YahooIsinSearchResolver", YahooIsinSearchResolver)
    .register("YahooEquityQuoteResolver", YahooEquityQuoteResolver)
    .register("YahooFxResolver", YahooFxResolver)
    .register("TradingviewFundResolver", TradingviewFundResolver)
    .register(
      "EquityAttributeResolutionPlan",
      EquityAttributeResolutionPlan,
    )
    .register("FirstSuccessPlan", FirstSuccessJunction)
    .register("FxAttributeResolutionPlan", FxAttributeResolutionPlan)
    .register("PseQuoteResolutionPlan", PseQuoteResolutionPlan)
    .register("RoutingPlan", RoutingPlan)
    .register("StepPlan", FanOutJunction)
    .register("TerminalCollectorNode", TerminalCollectorNode)
    .register("TickerQuoteResolutionPlan", TickerQuoteResolutionPlan);
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
      `Ambiguous default attribute route for classification "${String(outcome.value.classification || "").toLowerCase()}": ${candidatePlans.map((plan) => plan.id).join(", ")}.`,
    );
  }

  return {
    attributePlan: candidatePlans[0],
    resolvedRequest: outcome.value,
  };
}


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

  assert.equal(plan.attributePlan.id, "ATTRIBUTE:EQUITY");
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
