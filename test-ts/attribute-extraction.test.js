const assert = require("node:assert/strict");
const test = require("node:test");

const { extractAttributeValue } = require("../dist/ts/core/index.js");

test("extractAttributeValue returns the final scalar for common quote attributes", () => {
  const quote = {
    currency: "USD",
    fullExchangeName: "NasdaqGS",
    longName: "Alphabet Inc.",
    regularMarketDayHigh: 300,
    regularMarketDayLow: 290,
    regularMarketPreviousClose: 294.9,
    regularMarketPrice: 294.46,
    regularMarketTime: 1775160002,
    regularMarketVolume: 13309515,
    symbol: "GOOG",
  };

  assert.equal(extractAttributeValue(quote, "price"), 294.46);
  assert.equal(extractAttributeValue(quote, "name"), "Alphabet Inc.");
  assert.equal(extractAttributeValue(quote, "currency"), "USD");
  assert.equal(extractAttributeValue(quote, "close"), 294.9);
  assert.equal(extractAttributeValue(quote, "change"), -0.4399999999999977);
  assert.equal(
    extractAttributeValue(quote, "changepct"),
    -0.4399999999999977 / 294.9,
  );
  assert.equal(extractAttributeValue(quote, "volume"), 13309515);
  assert.equal(extractAttributeValue(quote, "symbol"), "GOOG");
  assert.equal(extractAttributeValue(quote, "exchange"), "NasdaqGS");
  assert.equal(
    extractAttributeValue(quote, "tradetime").toISOString(),
    "2026-04-02T20:00:02.000Z",
  );
});

test("extractAttributeValue rejects unsupported output-currency conversion", () => {
  assert.throws(
    () =>
      extractAttributeValue(
        {
          currency: "USD",
          regularMarketPrice: 10,
        },
        "price@EUR",
      ),
    /Output-currency conversion is not yet supported in the TypeScript CLI\./,
  );
});
