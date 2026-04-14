const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DagPlan,
  FirstSuccessReceiver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  RequestClassifierResolver,
  ResolveFlow,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  FxRequest,
  EquityRequest,
  RequestInput,
  createConcreteResolverMaterializationDependencies,
} = require("../dist/ts/core/index.js");
const { createTextHttpResponse, createStaticResourceHttpFetch } = require("./resource-fixtures.js");
const { createStaticResolverServices } = require("./resolver-service-fixtures.js");

function createResolverMaterializationDependencies() {
  return {
    looksLikeIsin: (value) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(value)),
    resolverClassesByName: {
      FirstSuccessReceiver,
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

class FakeResolver {
  constructor(code) {
    this.code = code;
    this.name = code;
  }

  canHandle() {
    return true;
  }

  buildRuntimePlan() {
    return { nodes: [this], routeClass: this.name, routePath: this.name, routeState: {} };
  }

  describe() {
    return this.name;
  }

  static fromSpec(code) {
    return new this(code);
  }
}

// Minimal two-node graph: ROOT(FakeResolver) -> TERMINAL
const FAKE_GRAPH = {
  ROOT: { id: "ROOT", type: "FakeResolver", next: ["TERMINAL"] },
  TERMINAL: { id: "TERMINAL", type: "TERMINAL" },
};

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

test("ResolveFlow builds executable nodes directly from DagPlan", () => {
  const resolveFlow = new ResolveFlow(
    DagPlan,
    createResolverMaterializationDependencies(),
  );

  assert.equal(resolveFlow.getGraph().getRoot().id, "ROOT");
  assert.equal(resolveFlow.getGraph().getTerminal().id, "TERMINAL");
  assert.equal(resolveFlow.getGraph().getNode("YAHOO-QUOTE").type, "YahooEquityQuoteResolver");
  assert.equal(resolveFlow.resolveAttribute("USDUSD", "price"), 1);
});

test("ResolveFlow instantiates and registers resolvers by class name", () => {
  const flow = new ResolveFlow(FAKE_GRAPH, {
    looksLikeIsin: () => false,
    resolverClassesByName: { FakeResolver },
  });

  const resolver = flow.getResolver("ROOT");
  assert.ok(resolver instanceof FakeResolver);
  assert.equal(resolver.name, "ROOT");
});

test("ResolveFlow rejects unknown class names", () => {
  assert.throws(
    () =>
      new ResolveFlow(FAKE_GRAPH, {
        looksLikeIsin: () => false,
        resolverClassesByName: {},
      }),
    /Unknown resolver class "FakeResolver" for "ROOT"\./,
  );
});

test("ResolveFlow can instantiate concrete resolvers with class-specific dependencies", () => {
  const staticFetch = createStaticResourceHttpFetch();
  const services = createStaticResolverServices({
    httpFetch(url) {
      if (String(url) === "https://www.google.com/finance/quote/EUR-USD") {
        return createTextHttpResponse(`AF_initDataCallback({data:${JSON.stringify([
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
        ])},sideChannel:{}});</script>`);
      }

      if (String(url).includes("/v8/finance/chart/")) {
        return createTextHttpResponse(JSON.stringify({
          chart: {
            result: [{ meta: { regularMarketPrice: 12, symbol: "IBM" } }],
          },
        }));
      }

      if (String(url).includes("/v1/finance/search")) {
        return createTextHttpResponse(JSON.stringify({
          quotes: [{ symbol: "IBM", quoteType: "EQUITY", score: 1 }],
        }));
      }

      if (String(url).includes("tradingview.com")) {
        return createTextHttpResponse(`\n                  <html>\n                    <script>\n                      window.initData.symbolInfo = {\n                        "resolved_symbol":"TASE:KSMF59",\n                        "currency":"ILS",\n                        "description":"KSM KSMF59",\n                        "short_name":"KSMF59",\n                        "isin_displayed":"IL0000000001"\n                      };\n                    </script>\n                    trades at 17.25 ILS today\n                  </html>\n                `);
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

  const flow = new ResolveFlow(
    DagPlan,
    {
      looksLikeIsin: (v) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(String(v)),
      ...createConcreteResolverMaterializationDependencies(services),
    },
  );

  assert.ok(flow.getResolver("ISIN-RECEIVER") instanceof FirstSuccessReceiver);
  assert.ok(flow.getResolver("FX-IDENTITY") instanceof LocalFxResolver);
  assert.ok(flow.getResolver("GOOGLE-FX") instanceof GoogleFxResolver);
  assert.ok(flow.getResolver("PSE-FRAMES") instanceof PseFramesResolver);
  assert.ok(flow.getResolver("PSE-EDGE") instanceof PseEdgeResolver);
  assert.ok(flow.getResolver("YAHOO-QUOTE") instanceof YahooEquityQuoteResolver);
  assert.ok(flow.getResolver("YAHOO-FX") instanceof YahooFxResolver);
  assert.ok(flow.getResolver("TRADINGVIEW-FUND") instanceof TradingviewFundResolver);
  assert.ok(flow.getResolver("ISIN:PSE") instanceof PseIsinMapResolver);
  assert.ok(flow.getResolver("ISIN:YAHOO") instanceof YahooIsinSearchResolver);

  const pseFramesResolved = flow.getResolver("PSE-FRAMES").resolve(
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
  assert.equal(pseFramesResolved.value.symbol, "BDO.PS");

  const pseEdgeResolved = flow.getResolver("PSE-EDGE").resolve(
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
  assert.equal(pseEdgeResolved.value.symbol, "BDO.PS");

  const pseResolved = flow.getResolver("ISIN:PSE").resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: { baseAttribute: "price", outputCode: "", rawAttribute: "price", wantsOutputCurrency: false },
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

  const yahooResolved = flow.getResolver("ISIN:YAHOO").resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: { baseAttribute: "price", outputCode: "", rawAttribute: "price", wantsOutputCurrency: false },
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

  const googleResolved = flow.getResolver("GOOGLE-FX").resolve(
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
  assert.equal(googleResolved.value.regularMarketPrice, 1.25);
  assert.equal(googleResolved.value.hoodlefinanceFxGoogleSymbol, "CURRENCY:EURUSD");

  const tradingviewResolved = flow.getResolver("TRADINGVIEW-FUND").resolve(
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
  assert.equal(tradingviewResolved.value.regularMarketPrice, 17.25);
  assert.equal(tradingviewResolved.value.symbol, "KSMF59.TA");
});
