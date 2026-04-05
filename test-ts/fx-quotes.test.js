const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSameCurrencyQuote,
  decorateFxQuote,
  extractRawQuote,
  isSameCurrencyFxPair,
} = require("../dist/ts/core/index.js");

test("fx quote helpers preserve runtime-style FX metadata", () => {
  const fxPair = {
    baseCanonicalCode: "USD",
    canonicalPair: "USDUSD",
    displayQuoteCode: "USD",
    googleSymbol: "CURRENCY:USDUSD",
    isSameCurrency: true,
    pairDisplay: "USDUSD",
    quoteCanonicalCode: "USD",
    scale: 1,
    yahooChartSymbol: "USDUSD=X",
  };

  const quote = buildSameCurrencyQuote(fxPair);
  assert.equal(quote.currency, "USD");
  assert.equal(quote.hoodlefinanceFxGoogleSymbol, "CURRENCY:USDUSD");
  assert.equal(quote.symbol, "USDUSD");

  const decorated = decorateFxQuote(
    {
      regularMarketPrice: 1.25,
    },
    fxPair,
  );
  assert.equal(decorated.hoodlefinanceFxDisplayCurrency, "USD");
  assert.equal(decorated.shortName, "USDUSD");

  assert.deepEqual(extractRawQuote(decorated), {
    regularMarketPrice: 1.25,
    shortName: "USDUSD",
    symbol: "USDUSD",
  });
  assert.equal(isSameCurrencyFxPair(fxPair), true);
  assert.equal(
    isSameCurrencyFxPair({
      baseCanonicalCode: "EUR",
      quoteCanonicalCode: "USD",
      yahooChartSymbol: "EURUSD=X",
    }),
    false,
  );
});
