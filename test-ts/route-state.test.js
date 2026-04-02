const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EquityRequest,
  FxRequest,
  buildEquityYahooQuoteRouteState,
  buildFxQuoteRouteState,
  buildPseQuoteRouteState,
} = require("../dist/ts/core/index.js");

test("route-state builders preserve the small planner state payloads", () => {
  const equityRequest = new EquityRequest({
    allowTradingviewFallback: false,
    attribute: "price",
    exchange: "PSE",
    identifier: "PSE:BDO",
    identifierResolutionMs: 0,
    symbol: "BDO",
    yahooSymbol: "BDO.PS",
  });
  const fxRequest = new FxRequest({
    attribute: "price",
    fxPair: {
      baseCanonicalCode: "EUR",
      quoteCanonicalCode: "USD",
      yahooChartSymbol: "EURUSD=X",
    },
    identifier: "EURUSD",
    identifierResolutionMs: 0,
  });

  assert.deepEqual(buildPseQuoteRouteState(equityRequest), { symbol: "BDO" });
  assert.deepEqual(buildFxQuoteRouteState(fxRequest), {
    fxPair: fxRequest.fxPair,
  });
  assert.deepEqual(
    buildEquityYahooQuoteRouteState(equityRequest, (symbol) => `${symbol}:ALT`),
    {
      fxPair: null,
      preferredYahooSymbol: "BDO.PS:ALT",
      yahooSymbol: "BDO.PS",
    },
  );
  assert.deepEqual(buildEquityYahooQuoteRouteState(equityRequest), {
    fxPair: null,
    preferredYahooSymbol: "",
    yahooSymbol: "BDO.PS",
  });
});
