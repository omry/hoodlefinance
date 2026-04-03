const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatLookupResult,
  formatEnvelopeResult,
  formatTraceOutput,
  formatRoutingTable,
  formatRoutingTree,
  lookupEnvelopeWithEnvironment,
  lookupWithEnvironment,
  runSmokeSuite,
} = require("../tools/_shared/cli-ts.js");

function createFakeEnvironment() {
  return {
    directIdentifierResolver: {
      name: "DIRECT-IDENTIFIER",
      resolve(request) {
        if (request && request.ticker === "TLV:KSMF59") {
          return {
            elapsedMs: 0,
            status: "success",
            value: {
              attribute: request.attribute,
              identifier: request.identifier,
              requestType: "equity",
              symbol: "KSMF59",
              yahooSymbol: "KSM.F59.TA",
              allowTradingviewFallback: true,
            },
          };
        }

        return {
          elapsedMs: 0,
          status: "success",
          value: {
            attribute: request.attribute,
            identifier: request.identifier,
            requestType: "equity",
            yahooSymbol: "GOOG",
          },
        };
      },
    },
    googleFxResolver: {
      name: "GOOGLE",
      resolve() {
        return {
          elapsedMs: 0,
          status: "success",
          value: {
            regularMarketPrice: 1.25,
            shortName: "EURUSD",
            symbol: "EURUSD",
          },
        };
      },
    },
    localFxResolver: {
      name: "LOCAL",
      resolve() {
        return {
          elapsedMs: 0,
          status: "success",
          value: {
            regularMarketPrice: 1,
            shortName: "USDUSD",
            symbol: "USDUSD",
          },
        };
      },
    },
    pseIsinMapResolver: {
      name: "PSE-MAP",
      resolve(request) {
        return request.ticker === "PHY077751022" ||
          request.ticker === "ISIN:PHY077751022"
          ? {
              elapsedMs: 0,
              status: "success",
              value: {
                requestType: "equity",
                symbol: "BDO",
                yahooSymbol: "BDO.PS",
              },
            }
          : {
              elapsedMs: 0,
              error: "not found",
              status: "failure",
            };
      },
    },
    yahooIsinSearchResolver: {
      name: "YAHOO-ISIN",
      resolve(request) {
        return request.ticker === "US02079K1079" ||
          request.ticker === "ISIN:US02079K1079"
          ? {
              elapsedMs: 0,
              status: "success",
              value: {
                requestType: "equity",
                symbol: "GOOG",
                yahooSymbol: "GOOG",
              },
            }
          : {
              elapsedMs: 0,
              error: "not found",
              status: "failure",
            };
      },
    },
    yahooQuoteResolver: {
      name: "YAHOO",
      canHandle(request) {
        return !!request && request.requestType === "equity";
      },
      getRouteClass() {
        return "TICKER";
      },
      resolve(request) {
        if (request && request.yahooSymbol === "KSM.F59.TA") {
          return {
            elapsedMs: 0,
            error: "not found",
            status: "failure",
          };
        }

        return {
          elapsedMs: 0,
          status: "success",
          value: {
            currency: "USD",
            regularMarketPrice: 123.45,
            symbol: "GOOG",
          },
        };
      },
    },
    tradingviewFundResolver: {
      name: "TRADINGVIEW-FUND",
      traceLabel: "TRADINGVIEW",
      canHandle(request) {
        return !!request && request.requestType === "equity";
      },
      resolve() {
        return {
          elapsedMs: 0,
          status: "success",
          value: {
            currency: "ILS",
            exchangeName: "TASE",
            financialCurrency: "ILS",
            longName: "KSM KSMF59",
            regularMarketPrice: 17.25,
            shortName: "KSMF59",
            symbol: "KSMF59.TA",
          },
        };
      },
    },
  };
}

test("lookupWithEnvironment routes to the expected resolver family", () => {
  const env = createFakeEnvironment();

  const direct = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "GOOG",
  });
  assert.equal(direct.route, "TICKER -> YAHOO");
  assert.equal(direct.status, "success");
  assert.equal(direct.value, 123.45);

  const fx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "EURUSD",
  });
  assert.equal(fx.route, "FX -> GOOGLE");
  assert.equal(fx.status, "success");
  assert.equal(fx.value, 1.25);

  const sameCurrencyFx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "USDUSD",
  });
  assert.equal(sameCurrencyFx.route, "FX -> LOCAL");
  assert.equal(sameCurrencyFx.status, "success");
  assert.equal(sameCurrencyFx.value, 1);

  const isin = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "US02079K1079",
  });
  assert.equal(isin.route, "TICKER -> YAHOO");
  assert.equal(isin.status, "success");
  assert.equal(isin.value, 123.45);

  const tradingview = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "TLV:KSMF59",
  });
  assert.equal(tradingview.route, "TICKER -> TRADINGVIEW-FUND");
  assert.equal(tradingview.status, "success");
  assert.equal(tradingview.value, 17.25);
});

test("lookup formatting and routing views stay readable", () => {
  const env = createFakeEnvironment();
  const result = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "GOOG",
  });
  const output = formatLookupResult(result);
  const traceOutput = formatTraceOutput("GOOG", result);

  assert.equal(output, 123.45);
  assert.match(traceOutput, /^symbol: GOOG$/m);
  assert.match(traceOutput, /^planned route: TICKER -> YAHOO$/m);
  assert.match(traceOutput, /^result: success$/m);
  assert.match(formatRoutingTable(), /classification\texample\troute/);
  assert.match(formatRoutingTree(), /^ROOT$/m);
});

test("lookupEnvelopeWithEnvironment preserves the raw quote envelope", () => {
  const env = createFakeEnvironment();
  const envelope = lookupEnvelopeWithEnvironment(env, {
    attribute: "price",
    ticker: "TLV:KSMF59",
  });

  assert.equal(envelope.status, "success");
  assert.equal(envelope.kind, "quote");
  assert.equal(envelope.route, "TICKER -> TRADINGVIEW-FUND");
  assert.equal(envelope.value.regularMarketPrice, 17.25);

  const output = formatEnvelopeResult(envelope);
  assert.match(output, /"value": \{/m);
  assert.match(output, /"regularMarketPrice": 17\.25/m);
});

test("lookup formatting returns null for failures", () => {
  const env = createFakeEnvironment();
  const output = formatLookupResult(
    lookupWithEnvironment(env, {
      attribute: "price",
      ticker: "ISIN:NOPE",
    }),
  );

  assert.equal(output, null);
});

test("runSmokeSuite validates the supported CLI smoke paths", () => {
  const env = createFakeEnvironment();
  const smoke = runSmokeSuite(env);

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});
