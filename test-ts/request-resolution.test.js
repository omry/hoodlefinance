const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveRequestValue,
} = require("../dist/ts/core/index.js");
const { createTextHttpResponse } = require("./resource-fixtures.js");
const { createTestResolverServices } = require("./resolver-service-fixtures.js");

function createEnv(overrides = {}) {
  const counters = {
    selectLookupExecution: 0,
  };
  const resolverServices = createTestResolverServices({
    getCachedString(key) {
      if (typeof overrides.getCachedString === "function") {
        return overrides.getCachedString(key);
      }

      return "";
    },
    httpFetch(url) {
      if (typeof overrides.httpFetch === "function") {
        return overrides.httpFetch(url);
      }

      return createTextHttpResponse("");
    },
    putCachedString(key, value, _ttlSeconds) {
      if (typeof overrides.putCachedString === "function") {
        return overrides.putCachedString(key, value);
      }

      return String(value || "");
    },
  });

  return {
    selectLookupExecution() {
      counters.selectLookupExecution += 1;

      if (typeof overrides.selectLookupExecution === "function") {
        return overrides.selectLookupExecution.apply(this, arguments);
      }

      throw new Error("selectLookupExecution should not be called for this test");
    },
    counters,
    getCachedString: resolverServices.getCachedString,
    httpFetch: resolverServices.httpFetch,
    looksLikeIsin() {
      return false;
    },
    putCachedString: resolverServices.putCachedString,
  };
}

function createRequestInput(overrides = {}) {
  const attribute = overrides.attribute || "price";
  const attributeType = overrides.attributeType || (attribute === "isin" ? "isin" : "quote");

  return {
    attribute,
    attributeType,
    identifier: "GOOG",
    infoMode: "",
    sourceOverride: "",
    ticker: "GOOG",
    ...overrides,
  };
}

test("resolveRequestValue rejects deferred modes before direct isin fast paths", () => {
  const infoModeResult = resolveRequestValue(
    createEnv(),
    createRequestInput({
      attribute: "isin",
      infoMode: "source-list",
      ticker: "ISIN:US02079K1079",
    }),
  );

  assert.equal(infoModeResult.status, "failure");
  assert.equal(infoModeResult.route, "(none)");
  assert.match(
    infoModeResult.error,
    /Ticker route introspection is not yet available\./,
  );

  const sourceOverrideResult = resolveRequestValue(
    createEnv(),
    createRequestInput({
      attribute: "isin",
      sourceOverride: "YAHOO",
      ticker: "PSE:BDO",
    }),
  );

  assert.equal(sourceOverrideResult.status, "failure");
  assert.equal(sourceOverrideResult.route, "(none)");
  assert.match(
    sourceOverrideResult.error,
    /"@YAHOO" is not available for this request\./,
  );
});

test("resolveRequestValue resolves explicit-source isin requests without quote planning", () => {
  const pseEnv = createEnv({
    httpFetch(url) {
      assert.equal(url, "https://frames.pse.com.ph/security/BDO");
      return createTextHttpResponse(`
        <html>
          <input
            id="stock-json"
            value="{&quot;full_name&quot;:&quot;BDO Unibank, Inc.&quot;,&quot;name&quot;:&quot;BDO&quot;}"
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
    },
  });

  const pseResult = resolveRequestValue(
    pseEnv,
    createRequestInput({ attribute: "isin", ticker: "PSE:BDO" }),
  );

  assert.equal(pseEnv.counters.selectLookupExecution, 0);
  assert.equal(pseResult.status, "success");
  assert.equal(pseResult.value, "PHY077751022");

  const lonEnv = createEnv({
    httpFetch(url) {
      assert.equal(
        url,
        "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA",
      );
      return createTextHttpResponse(`
        <html>
          <table>
            <tr>
              <td>SJPA</td>
              <td>
                <span>UpdateOpener('1','US0000000001|GB|GBP|LSE|123|SJPA')</span>
                <a href="/instrument/SJPA">SJPA Holdings</a>
              </td>
            </tr>
          </table>
        </html>
      `);
    },
  });

  const lonResult = resolveRequestValue(
    lonEnv,
    createRequestInput({ attribute: "isin", ticker: "LON:SJPA" }),
  );

  assert.equal(lonEnv.counters.selectLookupExecution, 0);
  assert.equal(lonResult.status, "success");
  assert.equal(lonResult.value, "US0000000001");
});

test("resolveRequestValue still uses quote planning for ambiguous isin requests", () => {
  let selectLookupExecutionCalls = 0;
  const env = createEnv({
    selectLookupExecution() {
      selectLookupExecutionCalls += 1;
      return {
        attributePlan: {
          describe() {
            return "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER";
          },
          resolve() {
            return {
              status: "success",
              value: {
                exchangeName: "NMS",
                fullExchangeName: "NasdaqGS",
                symbol: "GOOG",
              },
            };
          },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        resolvedRequest: {
          attribute: "price",
          identifier: "GOOG",
        },
      };
    },
    httpFetch(url) {
      assert.equal(url, "https://www.tradingview.com/symbols/NASDAQ-GOOG/");
      return createTextHttpResponse(`
        <html>
          <script>
            window.initData.symbolInfo = {
              "resolved_symbol":"NASDAQ:GOOG",
              "isin_displayed":"US02079K1079"
            };
          </script>
        </html>
      `);
    },
  });

  const result = resolveRequestValue(
    env,
    createRequestInput({ attribute: "isin", ticker: "GOOG" }),
  );

  assert.equal(selectLookupExecutionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, "US02079K1079");
});

test("resolveRequestValue supports quote-based LON isin resolution", () => {
  let selectLookupExecutionCalls = 0;
  let fetchCalls = 0;
  const cache = new Map();
  const env = createEnv({
    selectLookupExecution() {
      selectLookupExecutionCalls += 1;
      return {
        attributePlan: {
          describe() {
            return "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER";
          },
          resolve() {
            return {
              status: "success",
              value: {
                exchangeName: "LSE",
                symbol: "VOD.L",
              },
            };
          },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        resolvedRequest: {
          attribute: "price",
          identifier: "VOD",
        },
      };
    },
    httpFetch(url) {
      fetchCalls += 1;
      assert.equal(
        url,
        "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=VOD",
      );
      return createTextHttpResponse(`
        <html>
          <table>
            <tr>
              <td>VOD</td>
              <td>
                <span>UpdateOpener('1','GB00BH4HKS39|GB|GBP|LSE|123|VOD')</span>
                <a href="/instrument/VOD">Vodafone Group</a>
              </td>
            </tr>
          </table>
        </html>
      `);
    },
    getCachedString(key) {
      return cache.get(key) || "";
    },
    putCachedString(key, value) {
      const normalized = String(value || "");
      cache.set(key, normalized);
      return normalized;
    },
  });

  const result = resolveRequestValue(
    env,
    createRequestInput({ attribute: "isin", ticker: "VOD" }),
  );
  const repeatedResult = resolveRequestValue(
    env,
    createRequestInput({ attribute: "isin", ticker: "VOD" }),
  );

  assert.equal(selectLookupExecutionCalls, 2);
  assert.equal(fetchCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, "GB00BH4HKS39");
  assert.equal(repeatedResult.status, "success");
  assert.equal(repeatedResult.value, "GB00BH4HKS39");
});

test("resolveRequestValue uses the attribute plan for output-currency conversion", () => {
  let conversionCalls = 0;
  const env = createEnv({
    selectLookupExecution() {
      return {
        attributePlan: {
          describe() {
            return "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER";
          },
          resolve() {
            return {
              status: "success",
              value: {
                currency: "PHP",
                regularMarketPrice: 100,
              },
            };
          },
          resolveOutputCurrencyResult(requestInput, quote) {
            conversionCalls += 1;
            assert.equal(requestInput.attribute, "price@USD");
            assert.equal(quote.currency, "PHP");
            return {
              attemptedRoutes: ["DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX"],
              route: "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
              status: "success",
              value: 0.02,
            };
          },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        resolvedRequest: {
          attribute: "price@USD",
          identifier: "BDO",
        },
      };
    },
  });

  const result = resolveRequestValue(
    env,
    createRequestInput({ attribute: "price@USD", ticker: "PSE:BDO" }),
  );

  assert.equal(conversionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, 2);
  assert.deepEqual(result.attemptedRoutes, [
    "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
    "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
  ]);
});

test("resolveRequestValue uses buildAttributePlan for identifier-first output-currency conversion", () => {
  let conversionCalls = 0;
  const env = createEnv({
    selectLookupExecution() {
      return {
        buildAttributePlan() {
          return {
            describe() {
              return "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER";
            },
            resolve() {
              return {
                status: "success",
                value: {
                  currency: "PHP",
                  regularMarketPrice: 100,
                },
              };
            },
            resolveOutputCurrencyResult(requestInput, quote) {
              conversionCalls += 1;
              assert.equal(requestInput.attribute, "price@USD");
              assert.equal(quote.currency, "PHP");
              return {
                attemptedRoutes: ["DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX"],
                route: "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
                status: "success",
                value: 0.02,
              };
            },
          };
        },
        identifierPlan: {
          describe() {
            return "IDENTIFIER:ISIN -> ISIN:YAHOO";
          },
          resolve() {
            return {
              status: "success",
              value: {
                attribute: "price@USD",
                classification: "equity",
                exchange: "PSE",
                input: {
                  attribute: "price@USD",
                  identifier: "PHY077751022",
                },
                requestType: "equity",
                symbol: "BDO",
                yahooSymbol: "BDO.PS",
              },
            };
          },
        },
        resolvedRequest: null,
      };
    },
  });

  const result = resolveRequestValue(
    env,
    createRequestInput({
      attribute: "price@USD",
      classification: "isin",
      ticker: "PHY077751022",
    }),
  );

  assert.equal(conversionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, 2);
  assert.deepEqual(result.attemptedRoutes, [
    "IDENTIFIER:ISIN -> ISIN:YAHOO",
    "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
    "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
  ]);
});
