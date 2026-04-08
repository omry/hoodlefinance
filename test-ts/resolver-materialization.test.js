const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
  FxRequest,
  EquityRequest,
  RequestInput,
  createConcreteResolverMaterializationDependencies,
  getMaterializedResolverByCode,
  getRegisteredResolverByName,
  materializeResolversByCode,
} = require("../dist/ts/core/index.js");

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

test("materializeResolversByCode instantiates and registers resolvers by class name", () => {
  const registry = materializeResolversByCode(
    { YAHOO: "FakeResolver" },
    {
      resolverClassesByName: {
        FakeResolver,
      },
    },
  );

  const resolver = getMaterializedResolverByCode(registry, "yahoo");
  assert.equal(registry.byCode.YAHOO, resolver);
  assert.equal(getRegisteredResolverByName(registry.byName, "YAHOO"), resolver);
  assert.equal(resolver?.name, "YAHOO");
});

test("materializeResolversByCode rejects unknown class names", () => {
  assert.throws(
    () =>
      materializeResolversByCode(
        { YAHOO: "MissingResolver" },
        {
          resolverClassesByName: {},
        },
      ),
    /Unknown resolver class "MissingResolver" for "YAHOO"\./,
  );
});

test("materializeResolversByCode can instantiate concrete resolvers with class-specific dependencies", () => {
  const services = {
    httpFetch(url) {
      if (String(url) === "https://www.google.com/finance/quote/EUR-USD") {
        return `AF_initDataCallback({data:${JSON.stringify([
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
        ])},sideChannel:{}});</script>`;
      }

      if (String(url).includes("/v8/finance/chart/")) {
        return JSON.stringify({
          chart: {
            result: [{ meta: { regularMarketPrice: 12, symbol: "IBM" } }],
          },
        });
      }

      if (String(url).includes("/v1/finance/search")) {
        return JSON.stringify({
          quotes: [{ symbol: "IBM", quoteType: "EQUITY", score: 1 }],
        });
      }

      if (String(url).includes("tradingview.com")) {
        return `\n                  <html>\n                    <script>\n                      window.initData.symbolInfo = {\n                        "resolved_symbol":"TASE:KSMF59",\n                        "currency":"ILS",\n                        "description":"KSM KSMF59",\n                        "short_name":"KSMF59",\n                        "isin_displayed":"IL0000000001"\n                      };\n                    </script>\n                    trades at 17.25 ILS today\n                  </html>\n                `;
      }

      if (String(url).indexOf("companyDirectory/search.ax") >= 0) {
        return `
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
          `;
      }

      if (
        String(url) ===
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
      ) {
        return "PHY077751022=PSE:BDO\n";
      }

      if (String(url).indexOf("frames.pse.com.ph/security/") >= 0) {
        return `
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
          `;
      }

      return `
          <html>
            <div class="compInfo"><p>BDO Unibank, Inc.</p></div>
            <select>
              <option value="BDO" selected>BDO</option>
            </select>
            <table>
              <tr><th>Previous Close and Date</th><td>9.75</td></tr>
              <tr><th>Last Traded Price</th><td>9.87</td></tr>
              <tr><th>Change(% Change)</th><td>up 0.12 (1.23%)</td></tr>
              <tr><th>ISIN</th><td>PHY077751022</td></tr>
              <tr><th>High</th><td>10.10</td></tr>
              <tr><th>Low</th><td>9.60</td></tr>
              <tr><th>Open</th><td>9.80</td></tr>
              <tr><th>Volume</th><td>12345</td></tr>
            </table>
            As of Jan 2, 2024 3:00 PM
          </html>
        `;
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
  };

  const registry = materializeResolversByCode(
    {
      "RESOLVED-IDENTIFIER": "DirectIdentifierResolver",
      LOCAL: "LocalFxResolver",
      "ISIN:PSE": "PseIsinMapResolver",
      "ISIN:YAHOO": "YahooIsinSearchResolver",
      YAHOO: "YahooQuoteResolver",
      "TRADINGVIEW-FUND": "TradingviewFundResolver",
      GOOGLE: "GoogleFxResolver",
      "PSE-FRAMES": "PSEFramesResolver",
      "PSE-EDGE": "PSEEdgeResolver",
    },
    createConcreteResolverMaterializationDependencies(services),
  );

  assert.equal(
    registry.byCode["RESOLVED-IDENTIFIER"] instanceof DirectIdentifierResolver,
    true,
  );
  assert.equal(registry.byCode.LOCAL instanceof LocalFxResolver, true);
  assert.equal(registry.byCode.GOOGLE instanceof GoogleFxResolver, true);
  assert.equal(registry.byCode["PSE-FRAMES"] instanceof PseFramesResolver, true);
  assert.equal(registry.byCode["PSE-EDGE"] instanceof PseEdgeResolver, true);
  assert.equal(registry.byCode.YAHOO instanceof YahooQuoteResolver, true);
  assert.equal(
    registry.byCode["TRADINGVIEW-FUND"] instanceof TradingviewFundResolver,
    true,
  );
  assert.equal(registry.byCode["ISIN:PSE"] instanceof PseIsinMapResolver, true);
  assert.equal(
    registry.byCode["ISIN:YAHOO"] instanceof YahooIsinSearchResolver,
    true,
  );
  const pseFramesResolved = registry.byCode["PSE-FRAMES"].resolve(
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
  assert.equal(pseFramesResolved.value.symbol, "BDO");

  const pseEdgeResolved = registry.byCode["PSE-EDGE"].resolve(
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
  assert.equal(pseEdgeResolved.value.symbol, "BDO");

  const resolved = registry.byCode["RESOLVED-IDENTIFIER"].resolve(
    new RequestInput({
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
    }),
  );

  assert.equal(resolved.status, "success");
  assert.equal(resolved.value.yahooSymbol, "GOOG");

  const pseResolved = registry.byCode["ISIN:PSE"].resolve(
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

  const yahooResolved = registry.byCode["ISIN:YAHOO"].resolve(
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

  const googleResolved = registry.byCode.GOOGLE.resolve(
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
  assert.equal(
    googleResolved.value.hoodlefinanceFxGoogleSymbol,
    "CURRENCY:EURUSD",
  );

  const tradingviewResolved = registry.byCode["TRADINGVIEW-FUND"].resolve(
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
