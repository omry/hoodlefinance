const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EquityRequest,
  FxRequest,
  buildEquityYahooQuoteRouteState,
  buildFxQuoteRouteState,
  buildIsinIdentifierRouteState,
  buildPseQuoteRouteState,
  createRequestInput,
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

  const requestInput = createRequestInput("ISIN:US02079K1079", "price", {
    extractTickerExchange() {
      return "";
    },
    extractYahooExchangeFromSymbol() {
      return "";
    },
    isPseTicker() {
      return false;
    },
    isPseYahooSymbol() {
      return false;
    },
    looksLikeIsraeliFundYahooSymbol() {
      return false;
    },
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    normalizeAttribute(attribute) {
      return String(attribute == null ? "price" : attribute).trim() || "price";
    },
    normalizeTickerWithoutIsin(ticker) {
      return String(ticker).trim().toUpperCase();
    },
    parseAttributeRequest(attribute) {
      return {
        baseAttribute: String(attribute).split("@")[0].toLowerCase(),
        outputCode: "",
        rawAttribute: String(attribute),
        wantsOutputCurrency: false,
      };
    },
    parseFxTicker() {
      return null;
    },
    parsePseSymbol(ticker) {
      return String(ticker).trim().toUpperCase();
    },
    parsePseYahooSymbol(ticker) {
      return String(ticker).trim().toUpperCase();
    },
    parseTickerRequest(ticker) {
      return { infoMode: "", sourceOverride: "", ticker: String(ticker).trim() };
    },
  });

  assert.deepEqual(
    buildIsinIdentifierRouteState(
      requestInput,
      () => "US02079K1079",
    ),
    {
      input: requestInput,
      isin: "US02079K1079",
    },
  );
});
