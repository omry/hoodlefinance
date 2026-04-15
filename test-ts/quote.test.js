const assert = require("node:assert/strict");
const test = require("node:test");

const { FxQuote, StockQuote } = require("../dist/ts/core/index.js");

test("quote models serialize only present fields", () => {
  const stockQuote = new StockQuote({
    currency: "GBp",
    exchangeDataDelayedBy: 0,
    exchangeName: "",
    financialCurrency: "GBp",
    longName: "Example Plc",
    regularMarketPrice: 250,
    regularMarketVolume: 0,
    shortName: null,
    symbol: "EXM",
  });

  assert.deepEqual(stockQuote.toJSON(), {
    symbol: "EXM",
    currency: "GBP",
    financialCurrency: "GBP",
    longName: "Example Plc",
    regularMarketPrice: 2.5,
    regularMarketVolume: 0,
    exchangeDataDelayedBy: 0,
  });

  const fxQuote = new FxQuote({
    currency: "USD",
    exchangeDataDelayedBy: 0,
    fxUnitScale: 1,
    googleSymbol: "CURRENCY:USDJPY",
    regularMarketPrice: 149.2,
    shortName: "",
    symbol: "USDJPY",
  });

  assert.deepEqual(fxQuote.toJSON(), {
    currency: "USD",
    symbol: "USDJPY",
    googleSymbol: "CURRENCY:USDJPY",
    fxUnitScale: 1,
    regularMarketPrice: 149.2,
    exchangeDataDelayedBy: 0,
  });
});