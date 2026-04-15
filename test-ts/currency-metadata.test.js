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

test.todo(
  "GAP: Resource metadata parser (parity with hf_parseCurrencyCodeDataResource_)",
);

test.todo("GAP: Resource metadata parser validation");
