const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractAttributeValue,
} = require("../dist/ts/core/index.js");

test("extractAttributeValue handles standard numeric and text fields", () => {
  const quote = {
    regularMarketPrice: 150.25,
    regularMarketPreviousClose: 148.50,
    longName: "Apple Inc.",
    symbol: "AAPL",
    currency: "USD",
    regularMarketDayHigh: 151.00,
    regularMarketDayLow: 149.00,
    regularMarketVolume: 1000000,
    regularMarketTime: 1625097600, // 2021-06-30
    exchangeDataDelayedBy: 15,
  };

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
  const fxQuote = {
    symbol: "EURUSD=X",
    hoodlefinanceFxDisplayCurrency: "USD",
  };

  assert.throws(() => extractAttributeValue(fxQuote, "high"), /is not available for currency-pair identifiers/);
  assert.throws(() => extractAttributeValue(fxQuote, "low"), /is not available for currency-pair identifiers/);
  assert.throws(() => extractAttributeValue(fxQuote, "volume"), /is not available for currency-pair identifiers/);
});

// --- ACTUAL GAPS (EXPECTED TO FAIL) ---

test("GAP: exchange:google style mapping (e.g. NasdaqGS -> NASDAQ)", () => {
  const quote = {
    symbol: "AAPL",
    fullExchangeName: "NasdaqGS",
  };

  // Legacy logic maps NasdaqGS to NASDAQ in Google style
  assert.equal(extractAttributeValue(quote, "exchange:google"), "NASDAQ");
});

test("GAP: isin attribute extraction", () => {
  const quote = {
    symbol: "AAPL",
    isin: "US0378331005",
  };

  // Currently missing in TS extractAttributeValue switch
  assert.equal(extractAttributeValue(quote, "isin"), "US0378331005");
});

test("GAP: output-currency conversion (price@USD)", () => {
  const quote = {
    symbol: "BDO.PS",
    regularMarketPrice: 100,
    currency: "PHP",
  };

  // Currently explicitly disabled in TS core
  assert.doesNotThrow(() => extractAttributeValue(quote, "price@USD"));
});
