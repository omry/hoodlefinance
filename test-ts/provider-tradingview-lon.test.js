const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core has some Tradingview logic, but missing full parity with hf_extractTradingviewCode_
// and hf_extractLonCode_ legacy logic.
const {
  buildIsraeliFundTradingviewFallbackInfo
} = require("../dist/ts/core/tradingview-fund.js");
const Core = require("../dist/ts/core/index.js");

test.todo("GAP: Tradingview code extraction parity");

test.todo("GAP: LON code extraction parity");

test("GAP: Tradingview Israeli fund fallback parity", () => {
  // Current implementation (line 8 in tradingview-fund.ts) handles .TA -> TASE:
  // But we need to ensure it matches legacy's hf_normalizeTradingviewCodeForExchange_ behavior.
  const info = buildIsraeliFundTradingviewFallbackInfo("123456.TA");
  assert.equal(info.expectedSymbol, "TASE:123456");
});
