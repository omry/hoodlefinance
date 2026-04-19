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
  assert.equal(extractAttributeValue(quote, "high"), 151.0);
  assert.equal(extractAttributeValue(quote, "low"), 149.0);
  assert.equal(extractAttributeValue(quote, "close"), 148.5);
  assert.equal(extractAttributeValue(quote, "change"), 1.75);
  assert.equal(extractAttributeValue(quote, "changepct"), 1.75 / 148.5);
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

  assert.throws(
    () => extractAttributeValue(fxQuote, "high"),
    /is not available for currency-pair identifiers/,
  );
  assert.throws(
    () => extractAttributeValue(fxQuote, "low"),
    /is not available for currency-pair identifiers/,
  );
  assert.throws(
    () => extractAttributeValue(fxQuote, "volume"),
    /is not available for currency-pair identifiers/,
  );
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

  // --- Identity: USD -> USD should just return the price ---
  assert.equal(extractAttributeValue(usdQuote, "price@USD"), 150);

  // --- Error Handling for Unsupported Attributes ---
  assert.throws(
    () => extractAttributeValue(usdQuote, "price@EUR"),
    /currently unavailable/,
  );
  assert.throws(
    () => extractAttributeValue(usdQuote, "currency@USD"),
    /does not support output-currency conversion/,
  );
});

test("extractAttributeValue preserves raw GBp stock unit values", () => {
  const gbpUnitQuote = new StockQuote({
    currency: "GBp",
    regularMarketDayHigh: 260,
    regularMarketDayLow: 240,
    regularMarketPreviousClose: 245,
    regularMarketPrice: 250,
    symbol: "TSCO.L",
  });

  assert.equal(gbpUnitQuote.currency, "GBp");
  assert.equal(gbpUnitQuote.regularMarketPrice, 250);
  assert.equal(gbpUnitQuote.fxUnitScale, undefined);
  assert.equal(extractAttributeValue(gbpUnitQuote, "currency"), "GBp");
  assert.equal(extractAttributeValue(gbpUnitQuote, "price"), 250);
  assert.equal(extractAttributeValue(gbpUnitQuote, "high"), 260);
  assert.equal(extractAttributeValue(gbpUnitQuote, "low"), 240);
  assert.equal(extractAttributeValue(gbpUnitQuote, "close"), 245);
  assert.equal(extractAttributeValue(gbpUnitQuote, "change"), 5);
  assert.throws(
    () => extractAttributeValue(gbpUnitQuote, "price@GBP"),
    /currently unavailable/,
  );
});

test("extractAttributeValue preserves raw ILA stock unit values", () => {
  const ilsUnitQuote = new StockQuote({
    currency: "ILA",
    regularMarketDayHigh: 1250,
    regularMarketDayLow: 1190,
    regularMarketPreviousClose: 1210,
    regularMarketPrice: 1230,
    symbol: "TEVA.TA",
  });

  assert.equal(ilsUnitQuote.currency, "ILA");
  assert.equal(ilsUnitQuote.regularMarketPrice, 1230);
  assert.equal(ilsUnitQuote.fxUnitScale, undefined);
  assert.equal(extractAttributeValue(ilsUnitQuote, "currency"), "ILA");
  assert.equal(extractAttributeValue(ilsUnitQuote, "price"), 1230);
  assert.equal(extractAttributeValue(ilsUnitQuote, "high"), 1250);
  assert.equal(extractAttributeValue(ilsUnitQuote, "low"), 1190);
  assert.equal(extractAttributeValue(ilsUnitQuote, "close"), 1210);
  assert.equal(extractAttributeValue(ilsUnitQuote, "change"), 20);
  assert.equal(extractAttributeValue(ilsUnitQuote, "changepct"), 20 / 1210);
  assert.throws(
    () => extractAttributeValue(ilsUnitQuote, "price@ILS"),
    /currently unavailable/,
  );
});
