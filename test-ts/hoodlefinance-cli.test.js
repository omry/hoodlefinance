const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatLookupResult,
  formatRoutingTable,
  formatRoutingTree,
  lookupWithEnvironment,
  runSmokeSuite,
} = require("../dist/ts/hoodlefinance.js");

function createFakeEnvironment() {
  return {
    directIdentifierResolver: {
      resolve(request) {
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
  };
}

test("lookupWithEnvironment routes to the expected resolver family", () => {
  const env = createFakeEnvironment();

  const direct = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "GOOG",
  });
  assert.equal(direct.route, "DIRECT-IDENTIFIER");
  assert.equal(direct.status, "success");
  assert.equal(direct.value.yahooSymbol, "GOOG");

  const fx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "EURUSD",
  });
  assert.equal(fx.route, "FX -> GOOGLE");
  assert.equal(fx.status, "success");
  assert.equal(fx.value.regularMarketPrice, 1.25);

  const sameCurrencyFx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "USDUSD",
  });
  assert.equal(sameCurrencyFx.route, "FX -> LOCAL");
  assert.equal(sameCurrencyFx.status, "success");
  assert.equal(sameCurrencyFx.value.regularMarketPrice, 1);

  const isin = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "US02079K1079",
  });
  assert.equal(isin.route, "IDENTIFIER:ISIN -> YAHOO-ISIN");
  assert.equal(isin.status, "success");
  assert.equal(isin.value.yahooSymbol, "GOOG");
});

test("lookup formatting and routing views stay readable", () => {
  const env = createFakeEnvironment();
  const output = formatLookupResult(
    lookupWithEnvironment(env, {
      attribute: "price",
      ticker: "GOOG",
    }),
  );

  assert.match(output, /"route": "DIRECT-IDENTIFIER"/);
  assert.match(output, /"yahooSymbol": "GOOG"/);
  assert.match(formatRoutingTable(), /classification\texample\troute/);
  assert.match(formatRoutingTree(), /^ROOT$/m);
});

test("runSmokeSuite validates the supported CLI smoke paths", () => {
  const env = createFakeEnvironment();
  const smoke = runSmokeSuite(env);

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});
