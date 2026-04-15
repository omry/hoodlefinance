const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  EquityAttributeExtractResolver,
  FirstSuccessReceiver,
  FxAttributeExtractResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RawRequestInput,
  RequestClassifierResolver,
  RequestInput,
  TradingviewFundResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
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
      PSEEdgeResolver: PseEdgeResolver,
      PSEFramesResolver: PseFramesResolver,
      PseIsinMapResolver,
      RequestClassifierResolver,
      TradingviewFundResolver,
      YahooIsinSearchResolver,
      YahooEquityQuoteResolver,
      YahooFxResolver,
    },
    resolverServices: createStaticResolverServices(),
  };
}

function createRequestInput(identifier, attribute = "price") {
  return new RequestInput(identifier, attribute, {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    normalizeAttribute: (value) => String(value || "price"),
    parseAttributeRequest: (value) => ({
      baseAttribute: value,
      outputCode: "",
      rawAttribute: value,
      wantsOutputCurrency: false,
    }),
    parseFxTicker: (ticker) => {
      const normalized = String(ticker || "").trim().toUpperCase();

      if (normalized === "EURUSD") {
        return {
          baseCanonicalCode: "EUR",
          quoteCanonicalCode: "USD",
          yahooChartSymbol: "EURUSD=X",
        };
      }

      if (normalized === "USDUSD") {
        return {
          baseCanonicalCode: "USD",
          quoteCanonicalCode: "USD",
          yahooChartSymbol: "USDUSD=X",
        };
      }

      return null;
    },
    parseTickerRequest: (ticker) => ({
      infoMode: "",
      sourceOverride: "",
      ticker,
    }),
  });
}

test("compiled DagPlan classifies representative examples correctly", () => {
  const looksLikeIsin = (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value));
  const runtimeLookup = createRuntimePlanLookup(DagPlan, {
    ...createResolverMaterializationDependencies(),
    looksLikeIsin,
  });
  const rootNode = runtimeLookup.getNode("ROOT");
  const cases = [
    { example: "GOOG", expectedClassification: "equity" },
    { example: "PSE:BDO", expectedClassification: "equity" },
    { example: "EURUSD", expectedClassification: "fx" },
    { example: "USDUSD", expectedClassification: "fx" },
    { example: "US02079K1079", expectedClassification: "isin" },
    { example: "PHY077751022", expectedClassification: "isin" },
  ];

  for (const { example, expectedClassification } of cases) {
    const outcome = rootNode.resolve(new RawRequestInput(example, "price"));
    assert.equal(outcome.status, "success", `${example}: classification succeeded`);
    assert.equal(outcome.value.requestInput.classification, expectedClassification, `${example}: classification`);
  }
});
