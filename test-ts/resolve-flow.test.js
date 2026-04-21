const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildFxPairFromCodes,
  DagPlan,
  EquityAttributeExtractResolver,
  EquityAttributeResolutionPlan,
  FirstSuccessReceiver,
  FirstSuccessJunction,
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
  FlowNode,
  Flow,
  resolveAttribute,
  RoutingPlan,
  StepJunction,
  TickerQuoteResolutionPlan,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  FxRequest,
  EquityRequest,
  RequestInput,
  createConcreteResolverRegistry,
} = require("../dist/ts/core/index.js");
const {
  createTextHttpResponse,
  createStaticResourceHttpFetch,
} = require("./resource-fixtures.js");
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
    .registerLeaf("TradingviewFundResolver", TradingviewFundResolver)
    .registerLeaf("YahooIsinSearchResolver", YahooIsinSearchResolver)
    .registerLeaf("YahooEquityQuoteResolver", YahooEquityQuoteResolver)
    .registerLeaf("YahooFxResolver", YahooFxResolver)
    .registerPlan("EquityAttributeResolutionPlan", EquityAttributeResolutionPlan)
    .registerPlan("FirstSuccessPlan", FirstSuccessJunction)
    .registerPlan("FxAttributeResolutionPlan", FxAttributeResolutionPlan)
    .registerPlan("PseQuoteResolutionPlan", PseQuoteResolutionPlan)
    .registerPlan("RoutingPlan", RoutingPlan)
    .registerPlan("StepPlan", StepJunction)
    .registerPlan("TickerQuoteResolutionPlan", TickerQuoteResolutionPlan);
}

class FakeResolver extends FlowNode {
  constructor(code) {
    super(code);
  }

  canHandle() {
    return true;
  }

  buildRuntimePlan() {
    return {
      nodes: [this],
      routeClass: this.name,
      routePath: this.name,
      routeState: {},
    };
  }

  describe() {
    return this.id;
  }

  executeRouteRequest() {
    return {
      status: "success",
      value: { code: this.id },
    };
  }

}

// Minimal two-node graph: ROOT(FakeResolver) -> TERMINAL
const FAKE_GRAPH = {
  ROOT: { id: "ROOT", type: "FakeResolver", next: ["TERMINAL"] },
  TERMINAL: { id: "TERMINAL", type: "TERMINAL" },
};

function createDagPlanWithFxSubgraph() {
  return {
    ...DagPlan,
    "ATTRIBUTE:FX": {
      ...DagPlan["ATTRIBUTE:FX"],
      group: "FX",
    },
    "QUOTE:FX": {
      ...DagPlan["QUOTE:FX"],
      group: "FX",
    },
    "FX-IDENTITY": {
      ...DagPlan["FX-IDENTITY"],
      group: "FX",
    },
    "GOOGLE-FX": {
      ...DagPlan["GOOGLE-FX"],
      group: "FX",
    },
    "YAHOO-FX": {
      ...DagPlan["YAHOO-FX"],
      group: "FX",
    },
    "EXTRACT:EQUITY": {
      ...DagPlan["EXTRACT:EQUITY"],
      subgraphCalls: ["FX"],
    },
    "EXTRACT:FX": {
      ...DagPlan["EXTRACT:FX"],
      group: "FX",
    },
    __subgraphs__: {
      FX: {
        rootNodeId: "ATTRIBUTE:FX",
        terminalNodeId: "EXTRACT:FX",
      },
    },
  };
}

function createFxIdentityRequest() {
  return new FxRequest({
    attribute: "price",
    fxPair: buildFxPairFromCodes("USD", "USD"),
    identifier: "USDUSD",
    identifierResolutionMs: 0,
  });
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

test("Flowbuilds executable nodes directly from DagPlan", () => {
  const resolveFlow = new Flow(
    DagPlan,
    createResolverRegistry(),
    createStaticResolverServices(),
  );

  assert.equal(resolveFlow.getGraph().getRoot().id, "ROOT");
  assert.equal(resolveFlow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(
    resolveFlow.getGraph().getNode("YAHOO-QUOTE").type,
    "YahooEquityQuoteResolver",
  );
  assert.equal(resolveAttribute(resolveFlow, "USDUSD", "price"), 1);
});

test("Flowroutes price@CCY conversion through the production FX subgraph", () => {
  const services = createStaticResolverServices({
    httpFetch(url) {
      if (
        String(url) ===
        "https://query1.finance.yahoo.com/v8/finance/chart/TSCO.L?interval=1d&range=1d"
      ) {
        return createTextHttpResponse(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    currency: "GBp",
                    financialCurrency: "GBp",
                    regularMarketPrice: 250,
                    symbol: "TSCO.L",
                  },
                },
              ],
            },
          }),
        );
      }

      if (String(url) === "https://www.google.com/finance/quote/GBP-USD") {
        return createTextHttpResponse(
          `AF_initDataCallback({data:${JSON.stringify([
            [
              "GBP-USD",
              null,
              null,
              null,
              null,
              [1.25, 0.01],
              null,
              1.24,
              null,
              null,
              null,
              [1700000000],
              null,
              null,
              null,
              ["GBP", "USD", "British Pound"],
            ],
          ])},sideChannel:{}});</script>`,
        );
      }

      return createStaticResourceHttpFetch()(url);
    },
  });

  const resolveFlow = new Flow(
    DagPlan,
    createConcreteResolverRegistry(),
    services,
  );

  assert.equal(resolveAttribute(resolveFlow, "TSCO.L", "price@USD"), 3.125);
});

test("Flow instantiates and registers nodes by class name", () => {
  const flow = new Flow(FAKE_GRAPH, new NodeFactoryRegistry().registerLeaf("FakeResolver", FakeResolver));

  const flowNode = flow.getNode("ROOT");
  assert.ok(flowNode instanceof FakeResolver);
  assert.equal(flowNode.id, "ROOT");
});

test("Flowexposes declared subgraphs from explicit graph metadata", () => {
  const flow = new Flow(
    createDagPlanWithFxSubgraph(),
    createResolverRegistry(),
    createStaticResolverServices(),
  );

  assert.deepEqual(flow.getGraph().getSubgraphIds(), ["FX"]);
  assert.deepEqual(flow.getGraph().getSubgraph("FX"), {
    rootNodeId: "ATTRIBUTE:FX",
    terminalNodeId: "EXTRACT:FX",
  });
});

test("Flow.callSubgraph executes a declared subgraph with a bounded trace", () => {
  const flow = new Flow(
    createDagPlanWithFxSubgraph(),
    createResolverRegistry(),
    createStaticResolverServices(),
  );
  const trace = { visitedNodeIds: [] };

  const result = flow.callSubgraph("FX", createFxIdentityRequest(), trace);

  assert.equal(result.status, "success");
  assert.equal(result.value.extractedValue, 1);
  assert.deepEqual(trace.visitedNodeIds, [
    "SUBGRAPH:FX",
    "ATTRIBUTE:FX",
    "FX-IDENTITY",
    "EXTRACT:FX",
  ]);
  assert.equal(
    result.route,
    "SUBGRAPH:FX -> ATTRIBUTE:FX -> FX-IDENTITY -> EXTRACT:FX",
  );
  assert.deepEqual(trace.subgraphCallTraces, [
    {
      path: ["SUBGRAPH:FX", "ATTRIBUTE:FX", "FX-IDENTITY", "EXTRACT:FX"],
      route: "SUBGRAPH:FX -> ATTRIBUTE:FX -> FX-IDENTITY -> EXTRACT:FX",
      status: "success",
      subgraphId: "FX",
    },
  ]);
});

test("Flow.callSubgraph stores isolated call traces on a shared execution trace", () => {
  const flow = new Flow(
    createDagPlanWithFxSubgraph(),
    createResolverRegistry(),
    createStaticResolverServices(),
  );
  const trace = {
    visitedNodeIds: ["ROOT", "ATTRIBUTE"],
    subgraphCallTraces: [],
  };

  const result = flow.callSubgraph("FX", createFxIdentityRequest(), trace);

  assert.equal(
    result.route,
    "SUBGRAPH:FX -> ATTRIBUTE:FX -> FX-IDENTITY -> EXTRACT:FX",
  );
  assert.deepEqual(trace.visitedNodeIds, [
    "ROOT",
    "ATTRIBUTE",
    "SUBGRAPH:FX",
    "ATTRIBUTE:FX",
    "FX-IDENTITY",
    "EXTRACT:FX",
  ]);
  assert.deepEqual(trace.subgraphCallTraces, [
    {
      path: ["SUBGRAPH:FX", "ATTRIBUTE:FX", "FX-IDENTITY", "EXTRACT:FX"],
      route: "SUBGRAPH:FX -> ATTRIBUTE:FX -> FX-IDENTITY -> EXTRACT:FX",
      status: "success",
      subgraphId: "FX",
    },
  ]);
});

test("Flow.callSubgraph rejects unknown subgraph ids", () => {
  const flow = new Flow(
    createDagPlanWithFxSubgraph(),
    createResolverRegistry(),
    createStaticResolverServices(),
  );

  assert.throws(
    () => flow.callSubgraph("MISSING", createFxIdentityRequest()),
    /Unknown subgraph "MISSING"\./,
  );
});

test("FlowcallSubgraph routes through the FX subgraph correctly", () => {
  const flow = new Flow(
    DagPlan,
    createResolverRegistry(),
    createStaticResolverServices(),
  );

  const result = flow.callSubgraph("FX_CONVERSION", createFxIdentityRequest());

  assert.equal(result.status, "success");
  assert.equal(result.value.extractedValue, 1);
  assert.equal(
    result.route,
    "SUBGRAPH:FX_CONVERSION -> ATTRIBUTE:FX -> FX-IDENTITY -> EXTRACT:FX",
  );
});

test("Flowrejects unknown class names", () => {
  assert.throws(
    () =>
      new Flow(
        {
          ROOT: { id: "ROOT", type: "MissingResolver", next: ["TERMINAL"] },
          TERMINAL: { id: "TERMINAL", type: "TERMINAL" },
        },
        new NodeFactoryRegistry(),
      ),
    /Unknown node class "MissingResolver" for "ROOT"\./,
  );
});

test("Flow can instantiate concrete nodes with class-specific dependencies", () => {
  const staticFetch = createStaticResourceHttpFetch();
  const services = createStaticResolverServices({
    httpFetch(url) {
      if (String(url) === "https://www.google.com/finance/quote/EUR-USD") {
        return createTextHttpResponse(
          `AF_initDataCallback({data:${JSON.stringify([
            [
              "EUR-USD",
              null,
              null,
              null,
              null,
              [1.25, 0.01],
              null,
              1.24,
              null,
              null,
              null,
              [1700000000],
              null,
              null,
              null,
              ["EUR", "USD", "Euro"],
            ],
          ])},sideChannel:{}});</script>`,
        );
      }

      if (String(url).includes("/v8/finance/chart/")) {
        return createTextHttpResponse(
          JSON.stringify({
            chart: {
              result: [{ meta: { regularMarketPrice: 12, symbol: "IBM" } }],
            },
          }),
        );
      }

      if (String(url).includes("/v1/finance/search")) {
        return createTextHttpResponse(
          JSON.stringify({
            quotes: [{ symbol: "IBM", quoteType: "EQUITY", score: 1 }],
          }),
        );
      }

      if (String(url).includes("tradingview.com")) {
        return createTextHttpResponse(
          `\n                  <html>\n                    <script>\n                      window.initData.symbolInfo = {\n                        "resolved_symbol":"TASE:KSMF59",\n                        "currency":"ILS",\n                        "description":"KSM KSMF59",\n                        "short_name":"KSMF59",\n                        "isin_displayed":"IL0000000001"\n                      };\n                    </script>\n                    trades at 17.25 ILS today\n                  </html>\n                `,
        );
      }

      if (String(url).indexOf("companyDirectory/search.ax") >= 0) {
        return createTextHttpResponse(`
            <html>
              <table>
                <tr>
                  <td>
                    <a href="#" onclick="cmDetail('1234','5678');return false;">BDO Unibank, Inc.</a>
                  </td>
                  <td class="alignC"><a href="#">BDO</a></td>
                </tr>
              </table>
            </html>
          `);
      }

      if (
        String(url) ===
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
      ) {
        return createTextHttpResponse("PHY077751022=PSE:BDO\n");
      }

      if (String(url).indexOf("frames.pse.com.ph/security/") >= 0) {
        return createTextHttpResponse(`
            <html>
              <input
                id="stock-json"
                value="${JSON.stringify({
                  full_name: "BDO Unibank, Inc.",
                  name: "BDO",
                }).replace(/"/g, "&quot;")}"
              />
              <input id="symbol-json" value="BDO" />
              <h3>BDO</h3>
              <div>BDO Unibank, Inc.</div>
              <div>
                <a href="companyDisclosures/form.do?cmpy_id=1234">company</a>
              </div>
              <table>
                <tr><td>ISIN</td><td>PHY077751022</td></tr>
                <tr><td>Prev Close</td><td>9.75</td></tr>
                <tr><td>High</td><td>10.10</td></tr>
                <tr><td>Low</td><td>9.60</td></tr>
                <tr><td>Open</td><td>9.80</td></tr>
                <tr><td>Volume</td><td>12345</td></tr>
              </table>
              <h3 class="last-price">9.87</h3>
              As of Jan 2, 2024 3:00 PM
            </html>
          `);
      }

      return staticFetch(url);
    },
    getCachedJson() {
      return null;
    },
    getCachedString() {
      return "";
    },
    putCachedJson(_cacheKey, value) {
      return value;
    },
    putCachedString(_cacheKey, value) {
      return value;
    },
  });

  const flow = new Flow(
    DagPlan,
    createConcreteResolverRegistry(),
    services,
  );

  assert.ok(flow.getNode("ISIN-RECEIVER") instanceof FirstSuccessReceiver);
  assert.ok(flow.getNode("FX-IDENTITY") instanceof LocalFxResolver);
  assert.ok(flow.getNode("GOOGLE-FX") instanceof GoogleFxResolver);
  assert.ok(flow.getNode("PSE-FRAMES") instanceof PseFramesResolver);
  assert.ok(flow.getNode("PSE-EDGE") instanceof PseEdgeResolver);
  assert.ok(
    flow.getNode("YAHOO-QUOTE") instanceof YahooEquityQuoteResolver,
  );
  assert.ok(flow.getNode("YAHOO-FX") instanceof YahooFxResolver);
  assert.ok(
    flow.getNode("TRADINGVIEW-FUND") instanceof TradingviewFundResolver,
  );
  assert.ok(flow.getNode("ISIN:PSE") instanceof PseIsinMapResolver);
  assert.ok(flow.getNode("ISIN:YAHOO") instanceof YahooIsinSearchResolver);

  const pseFramesResolved = flow.getNode("PSE-FRAMES").execute(
    new EquityRequest({
      attribute: "price",
      allowTradingviewFallback: false,
      exchange: "PSE",
      identifier: "PSE:BDO",
      identifierResolutionMs: 0,
      symbol: "BDO",
      yahooSymbol: "BDO.PS",
    }),
  );
  assert.equal(pseFramesResolved.status, "success");
  assert.equal(pseFramesResolved.value.quote.symbol, "BDO.PS");

  const pseEdgeResolved = flow.getNode("PSE-EDGE").execute(
    new EquityRequest({
      attribute: "price",
      allowTradingviewFallback: false,
      exchange: "PSE",
      identifier: "PSE:BDO",
      identifierResolutionMs: 0,
      symbol: "BDO",
      yahooSymbol: "BDO.PS",
    }),
  );
  assert.equal(pseEdgeResolved.status, "success");
  assert.equal(pseEdgeResolved.value.quote.symbol, "BDO.PS");

  const pseResolved = flow.getNode("ISIN:PSE").execute(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "isin",
      fxPair: null,
      identifier: "ISIN:PHY077751022",
      infoMode: "",
      sourceOverride: "",
      ticker: "ISIN:PHY077751022",
      upperTicker: "ISIN:PHY077751022",
    }),
  );
  assert.equal(pseResolved.status, "success");
  assert.equal(pseResolved.value.exchange, "PSE");

  const yahooResolved = flow.getNode("ISIN:YAHOO").execute(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "isin",
      fxPair: null,
      identifier: "ISIN:US4592001014",
      infoMode: "",
      sourceOverride: "",
      ticker: "ISIN:US4592001014",
    }),
  );
  assert.equal(yahooResolved.status, "success");
  assert.equal(yahooResolved.value.yahooSymbol, "IBM");

  const googleResolved = flow.getNode("GOOGLE-FX").execute(
    new FxRequest({
      attribute: "price",
      fxPair: {
        baseCanonicalCode: "EUR",
        baseDisplayCode: "EUR",
        canonicalPair: "EURUSD",
        displayQuoteCode: "USD",
        googlePairSlug: "EUR-USD",
        googleSymbol: "CURRENCY:EURUSD",
        isSameCurrency: false,
        pairDisplay: "EURUSD",
        quoteCanonicalCode: "USD",
        quoteDisplayCode: "USD",
        scale: 1,
        yahooChartSymbol: "EURUSD=X",
      },
      identifier: "EURUSD",
      identifierResolutionMs: 0,
    }),
  );
  assert.equal(googleResolved.status, "success");
  assert.equal(googleResolved.value.quote.regularMarketPrice, 1.25);
  assert.equal(googleResolved.value.quote.googleSymbol, "CURRENCY:EURUSD");

  const tradingviewResolved = flow.getNode("TRADINGVIEW-FUND").execute(
    new EquityRequest({
      attribute: "price",
      allowTradingviewFallback: true,
      exchange: "TLV",
      identifier: "TLV:KSMF59",
      identifierResolutionMs: 0,
      symbol: "KSM.F59",
      yahooSymbol: "KSMF59.TA",
    }),
  );
  assert.equal(tradingviewResolved.status, "success");
  assert.equal(tradingviewResolved.value.quote.regularMarketPrice, 17.25);
  assert.equal(tradingviewResolved.value.quote.symbol, "KSMF59.TA");
});
