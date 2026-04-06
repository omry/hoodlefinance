const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core does not yet have a currency metadata resource parser.
// These tests record the expected behavior from the hf_parseCurrencyCodeDataResource_ legacy logic.
const Core = require("../dist/ts/core/index.js");

const MOCK_RESOURCE_JSON = JSON.stringify({
  canonicalCodes: ["USD", "EUR", "ILS", "GBP"],
  cryptoCodes: ["BTC", "ETH"],
  aliases: {
    GBp: {
      canonicalCode: "GBP",
      factor: 100,
    },
    ILR: {
      canonicalCode: "ILS",
      factor: 1,
    },
    XBT: {
      canonicalCode: "BTC",
      factor: 1,
    },
  },
});

test("GAP: Resource metadata parser (parity with hf_parseCurrencyCodeDataResource_)", { skip: "not yet implemented" }, () => {
  // We expect a parser in the core to handle the currency metadata JSON.
  assert.ok(typeof Core.parseCurrencyMetadata === "function", "parseCurrencyMetadata should be exported");
  
  const metadata = Core.parseCurrencyMetadata(MOCK_RESOURCE_JSON);
  
  // Verify canonical code extraction
  assert.ok(metadata["USD"], "USD should be present");
  assert.equal(metadata["USD"].assetClass, "currency");
  assert.equal(metadata["USD"].factor, 1);
  
  // Verify crypto code extraction
  assert.ok(metadata["BTC"], "BTC should be present");
  assert.equal(metadata["BTC"].assetClass, "crypto");
  assert.equal(metadata["BTC"].factor, 1);
  
  // Verify alias resolution (GBp -> GBP with factor 100)
  assert.ok(metadata["GBp"], "GBp alias should be present");
  assert.equal(metadata["GBp"].canonicalCode, "GBP");
  assert.equal(metadata["GBp"].factor, 100);
});

test("GAP: Resource metadata parser validation", { skip: "not yet implemented" }, () => {
  // Legacy throws "Currency code data is invalid" if the payload is bad.
  assert.throws(
    () => Core.parseCurrencyMetadata("not json"),
    /SyntaxError|Currency code data is invalid/
  );
  
  assert.throws(
    () => Core.parseCurrencyMetadata(JSON.stringify({ canonicalCodes: "not an array" })),
    /Currency code data is invalid/
  );
});
