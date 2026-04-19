const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildIsraeliFundTradingviewFallbackInfo,
  extractTradingviewFundQuote,
  extractTradingviewFundQuoteFromResponse,
} = require("../dist/ts/core/index.js");

test("TradingView fund helpers build fallback URLs and parse quotes", () => {
  const fallback = buildIsraeliFundTradingviewFallbackInfo("KSMF59.TA");

  assert.deepEqual(fallback, {
    expectedSymbol: "TASE:KSMF59",
    url: "https://www.tradingview.com/symbols/TASE-KSMF59/",
    yahooSymbol: "KSMF59.TA",
  });

  const html = `
    <html>
      <script>
        window.initData.symbolInfo = {
          "resolved_symbol":"TASE:KSMF59",
          "currency":"ILS",
          "description":"KSM KSMF59",
          "short_name":"KSMF59",
          "isin_displayed":"IL0000000001"
        };
      </script>
      trades at 17.25 ILS today
    </html>
  `;

  const quote = extractTradingviewFundQuote(html, "KSMF59.TA", "TASE:KSMF59");

  assert.equal(quote.currency, "ILS");
  assert.equal(quote.exchangeName, "TASE");
  assert.equal(quote.financialCurrency, "ILS");
  assert.equal(quote.isin, "IL0000000001");
  assert.equal(quote.longName, "KSM KSMF59");
  assert.equal(quote.regularMarketPrice, 17.25);
  assert.equal(quote.shortName, "KSMF59");
  assert.equal(quote.symbol, "KSMF59.TA");
});

test("TradingView fund helpers surface runtime-style lookup errors", () => {
  assert.throws(
    () =>
      extractTradingviewFundQuoteFromResponse(
        {
          getContentText() {
            return "";
          },
          getResponseCode() {
            return 500;
          },
        },
        "KSMF59.TA",
        "TASE:KSMF59",
      ),
    /TradingView quote lookup failed for "TASE:KSMF59" \(500\)\./,
  );
});
