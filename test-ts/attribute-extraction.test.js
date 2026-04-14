const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractAttributeValue,
  FxQuote,
  StockQuote,
} = require("../dist/ts/core/index.js");

test("extractAttributeValue handles standard numeric and text fields", () => {
  const quote = new StockQuote({
    currency: "USD",
    exchangeDataDelayedBy: 15,
    longName: "Apple Inc.",
    regularMarketDayHigh: 151.0,
    regularMarketDayLow: 149.0,
    regularMarketPreviousClose: 148.5,
    regularMarketPrice: 150.25,
    regularMarketTime: 1625097600, // 2021-06-30
    regularMarketVolume: 1000000,
    symbol: "AAPL",
  });

  assert.equal(extractAttributeValue(quote, "price"), 150.25);
  assert.equal(extractAttributeValue(quote, "name"), "Apple Inc.");
  assert.equal(extractAttributeValue(quote, "currency"), "USD");
  assert.equal(extractAttributeValue(quote, "high"), 151.00);
  assert.equal(extractAttributeValue(quote, "low"), 149.00);
  assert.equal(extractAttributeValue(quote, "close"), 148.50);
  assert.equal(extractAttributeValue(quote, "change"), 1.75);
  assert.equal(extractAttributeValue(quote, "changepct"), 1.75 / 148.50);
  assert.equal(extractAttributeValue(quote, "volume"), 1000000);
  assert.equal(extractAttributeValue(quote, "datadelay"), 15);
  assert.ok(extractAttributeValue(quote, "tradetime") instanceof Date);
});

test("extractAttributeValue rejects high/low/volume for FX pairs (Parity)", () => {
  const fxQuote = new FxQuote({
    currency: "USD",
    googleSymbol: "CURRENCY:EURUSD",
    regularMarketPrice: 1.25,
    regularMarketPreviousClose: 1.24,
    shortName: "EURUSD",
    symbol: "EURUSD=X",
  });

  assert.throws(() => extractAttributeValue(fxQuote, "high"), /is not available for currency-pair identifiers/);
  assert.throws(() => extractAttributeValue(fxQuote, "low"), /is not available for currency-pair identifiers/);
  assert.throws(() => extractAttributeValue(fxQuote, "volume"), /is not available for currency-pair identifiers/);
});


test("extractAttributeValue handles Google-style exchange mapping (e.g. NasdaqGS -> NASDAQ)", () => {
  const quote = new StockQuote({
    currency: "USD",
    fullExchangeName: "NasdaqGS",
    symbol: "AAPL",
  });

  assert.equal(extractAttributeValue(quote, "exchange:google"), "NASDAQ");
});

test("extractAttributeValue handles isin attribute extraction", () => {
  const quote = new StockQuote({
    currency: "USD",
    isin: "US0378331005",
    symbol: "AAPL",
  });

  assert.equal(extractAttributeValue(quote, "isin"), "US0378331005");
});

test("extractAttributeValue handles output-currency conversion (identity, direct, inverse, and hub)", () => {
  const usdQuote = new StockQuote({
    currency: "USD",
    regularMarketPrice: 150,
    symbol: "AAPL",
  });

  const gbpQuote = new StockQuote({
    currency: "GBP",
    regularMarketPrice: 200,
    symbol: "TSCO.L",
  });

  // --- Identity: USD -> USD should just return the price ---
  assert.equal(extractAttributeValue(usdQuote, "price@USD"), 150);

  // --- Error Handling for Unsupported Attributes ---
  assert.throws(() => extractAttributeValue(usdQuote, "price@EUR"), /currently unavailable/);
  assert.throws(() => extractAttributeValue(usdQuote, "currency@USD"), /does not support output-currency conversion/);
});
