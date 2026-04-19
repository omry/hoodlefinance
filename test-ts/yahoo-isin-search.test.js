const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildYahooIsinSearchUrl,
  canRenderGoogleExchangeFromYahooIdentity,
  extractYahooSymbolFromSearchPayload,
  inferYahooExchangeFromSearchQuote,
  selectYahooIsinSearchQuote,
} = require("../dist/ts/core/index.js");

test("Yahoo ISIN search helpers preserve the current URL and symbol-selection behavior", () => {
  assert.equal(
    buildYahooIsinSearchUrl("US02079K1079"),
    "https://query2.finance.yahoo.com/v1/finance/search?q=US02079K1079&quotesCount=10&newsCount=0",
  );
  assert.equal(canRenderGoogleExchangeFromYahooIdentity("NYSE"), true);
  assert.equal(
    inferYahooExchangeFromSearchQuote({ exchange: "NYSE", symbol: "IBM" }),
    "NYSE",
  );
  assert.equal(
    inferYahooExchangeFromSearchQuote({ exchange: "NASDAQ", symbol: "IBM" }),
    "NASDAQ",
  );
  assert.equal(
    inferYahooExchangeFromSearchQuote({ exchange: "", symbol: "BNP.PA" }),
    "PAR",
  );

  const selected = selectYahooIsinSearchQuote([
    {
      exchange: "UNKNOWN",
      quoteType: "ETF",
      score: 200,
      symbol: "FUND",
    },
    {
      exchange: "NYSE",
      quoteType: "EQUITY",
      score: 1,
      symbol: "IBM",
    },
  ]);

  assert.equal(selected.symbol, "IBM");
  assert.equal(
    extractYahooSymbolFromSearchPayload(
      {
        quotes: [
          { exchange: "NYSE", quoteType: "EQUITY", score: 1, symbol: "IBM" },
        ],
      },
      "US4592001014",
    ),
    "IBM",
  );
});
