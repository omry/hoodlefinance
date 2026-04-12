const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RawRequestInput,
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
    selectLookupExecution(rawInput) {
      counters.selectLookupExecution += 1;

      if (typeof overrides.selectLookupExecution === "function") {
        return overrides.selectLookupExecution.call(this, rawInput);
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
    ticker: "GOOG",
    ...overrides,
  };
}

test("resolveRequestValue rejects deferred info modes before direct isin fast paths", () => {
  const infoModeResult = resolveRequestValue(
    createEnv({
      selectLookupExecution() {
        return {
          attributePlan: null, buildAttributePlan: null, identifierPlan: null, resolvedRequest: null,
          requestInput: createRequestInput({ attribute: "isin", infoMode: "source-list", ticker: "ISIN:US02079K1079" }),
        };
      },
    }),
    new RawRequestInput("ISIN:US02079K1079", "isin"),
  );

  assert.equal(infoModeResult.status, "failure");
  assert.equal(infoModeResult.route, "(none)");
  assert.match(infoModeResult.error, /Ticker route introspection is not yet available\./);

  const sourceOverrideResult = resolveRequestValue(
    createEnv({
      selectLookupExecution() {
        return {
          attributePlan: null, buildAttributePlan: null, identifierPlan: null, resolvedRequest: null,
          requestInput: createRequestInput({ attribute: "isin", identifier: "PSE:BDO@YAHOO", infoMode: "source-override", ticker: "PSE:BDO" }),
        };
      },
    }),
    new RawRequestInput("PSE:BDO@YAHOO", "isin"),
  );

  assert.equal(sourceOverrideResult.status, "failure");
  assert.equal(sourceOverrideResult.route, "(none)");
  assert.match(sourceOverrideResult.error, /"@YAHOO" is not available for this request\./);
});

test("resolveRequestValue records raw-input classification as part of lookup flow", () => {
  let selectLookupExecutionCalls = 0;
  const env = createEnv({
    selectLookupExecution(rawInput) {
      selectLookupExecutionCalls += 1;
      assert.equal(rawInput instanceof RawRequestInput, true);
      assert.equal(rawInput.identifier, "GOOG");
      return {
        attributePlan: {
          describe() { return "ATTRIBUTE:EQUITY -> QUOTE:TICKER"; },
          resolve() { return { status: "success", value: { regularMarketPrice: 123.45 } }; },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        requestInput: createRequestInput({ attribute: rawInput.attribute, identifier: rawInput.identifier, ticker: rawInput.identifier }),
        resolvedRequest: { attribute: "price", classification: "equity", identifier: "GOOG" },
      };
    },
  });

  const result = resolveRequestValue(env, new RawRequestInput("GOOG", "price"));

  assert.equal(selectLookupExecutionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, 123.45);
  assert.equal(result.route, "ATTRIBUTE:EQUITY -> QUOTE:TICKER");
});

test("resolveRequestValue resolves direct isin requests without quote planning", () => {
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

  pseEnv.selectLookupExecution = function() {
    return {
      attributePlan: null, buildAttributePlan: null, identifierPlan: null, resolvedRequest: null,
      requestInput: createRequestInput({ attribute: "isin", ticker: "PSE:BDO" }),
    };
  };

  const pseResult = resolveRequestValue(pseEnv, new RawRequestInput("PSE:BDO", "isin"));

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

  lonEnv.selectLookupExecution = function() {
    return {
      attributePlan: null, buildAttributePlan: null, identifierPlan: null, resolvedRequest: null,
      requestInput: createRequestInput({ attribute: "isin", ticker: "LON:SJPA" }),
    };
  };

  const lonResult = resolveRequestValue(lonEnv, new RawRequestInput("LON:SJPA", "isin"));

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
          describe() { return "ATTRIBUTE:EQUITY -> QUOTE:TICKER"; },
          resolve() { return { status: "success", value: { exchangeName: "NMS", fullExchangeName: "NasdaqGS", symbol: "GOOG" } }; },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        requestInput: createRequestInput({ attribute: "isin", ticker: "GOOG" }),
        resolvedRequest: { attribute: "price", identifier: "GOOG" },
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

  const result = resolveRequestValue(env, new RawRequestInput("GOOG", "isin"));

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
          describe() { return "ATTRIBUTE:EQUITY -> QUOTE:TICKER"; },
          resolve() { return { status: "success", value: { exchangeName: "LSE", symbol: "VOD.L" } }; },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        requestInput: createRequestInput({ attribute: "isin", ticker: "VOD" }),
        resolvedRequest: { attribute: "price", identifier: "VOD" },
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

  const result = resolveRequestValue(env, new RawRequestInput("VOD", "isin"));
  const repeatedResult = resolveRequestValue(env, new RawRequestInput("VOD", "isin"));

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
            return "ATTRIBUTE:EQUITY -> QUOTE:TICKER";
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
              route: "ATTRIBUTE:FX -> QUOTE:FX",
              status: "success",
              value: 0.02,
            };
          },
        },
        buildAttributePlan: null,
        identifierPlan: null,
        requestInput: createRequestInput({ attribute: "price@USD", ticker: "PSE:BDO" }),
        resolvedRequest: { attribute: "price@USD", identifier: "BDO" },
      };
    },
  });

  const result = resolveRequestValue(env, new RawRequestInput("PSE:BDO", "price@USD"));

  assert.equal(conversionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, 2);
  assert.equal(result.route, "ATTRIBUTE:EQUITY -> QUOTE:TICKER");
});

test("resolveRequestValue uses buildAttributePlan for identifier-first output-currency conversion", () => {
  let conversionCalls = 0;
  const env = createEnv({
    selectLookupExecution() {
      return {
        buildAttributePlan() {
          return {
            describe() {
              return "ATTRIBUTE:EQUITY -> QUOTE:TICKER";
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
                route: "ATTRIBUTE:FX -> QUOTE:FX",
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
        requestInput: createRequestInput({ attribute: "price@USD", ticker: "PHY077751022" }),
        resolvedRequest: null,
      };
    },
  });

  const result = resolveRequestValue(env, new RawRequestInput("PHY077751022", "price@USD"));

  assert.equal(conversionCalls, 1);
  assert.equal(result.status, "success");
  assert.equal(result.value, 2);
  assert.equal(result.route, "ATTRIBUTE:EQUITY -> QUOTE:TICKER");
});
