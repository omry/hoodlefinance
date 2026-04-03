const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildYahooChartUrl,
  buildYahooQuoteLookupErrorMessage,
  extractYahooQuoteMetaFromPayload,
  extractYahooQuoteMetaFromResponse,
} = require("../dist/ts/core/index.js");

test("Yahoo quote helpers build chart URLs and parse quote meta", () => {
  assert.equal(
    buildYahooChartUrl("GOOG"),
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
  );

  const meta = extractYahooQuoteMetaFromPayload(
    {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 123,
              symbol: "GOOG",
            },
          },
        ],
      },
    },
    "GOOG",
  );
  assert.equal(meta.regularMarketPrice, 123);
  assert.equal(meta.symbol, "GOOG");
});

test("Yahoo quote helpers surface runtime-style errors", () => {
  assert.match(
    buildYahooQuoteLookupErrorMessage("GOOG", 500),
    /Quote lookup failed for GOOG \(500\)\./,
  );

  assert.throws(
    () =>
      extractYahooQuoteMetaFromResponse(
        {
          getContentText() {
            return "{}";
          },
          getResponseCode() {
            return 500;
          },
        },
        "GOOG",
      ),
    /Quote lookup failed for GOOG \(500\)\./,
  );

  assert.throws(
    () =>
      extractYahooQuoteMetaFromPayload(
        {
          chart: {
            result: [],
          },
        },
        "GOOG",
      ),
    /No quote data was found for GOOG\./,
  );
});
