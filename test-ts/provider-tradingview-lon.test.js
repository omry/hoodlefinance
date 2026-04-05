const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core has some Tradingview logic, but missing full parity with hf_extractTradingviewCode_
// and hf_extractLonCode_ legacy logic.
const {
  buildIsraeliFundTradingviewFallbackInfo
} = require("../dist/ts/core/tradingview-fund.js");
const Core = require("../dist/ts/core/index.js");

test("GAP: Tradingview code extraction parity", () => {
  // Legacy hf_extractTradingviewCode_ handles colon-prefixed tickers.
  // We expect a general utility in the core for this.
  assert.ok(typeof Core.extractTradingviewCode === "function", "extractTradingviewCode should be exported");
  
  // "NYSE:AAPL" -> "AAPL"
  assert.equal(Core.extractTradingviewCode("NYSE:AAPL"), "AAPL");
  
  // "AAPL.L" (Yahoo style) -> "AAPL" (Tradingview style)
  assert.equal(Core.extractTradingviewCode("AAPL.L"), "AAPL");
});

test("GAP: LON code extraction parity", () => {
  // Legacy hf_extractLonCode_ logic is entirely missing in TS core.
  assert.ok(typeof Core.extractLonCode === "function", "extractLonCode should be exported");
  
  // "LON:BP" -> "BP"
  assert.equal(Core.extractLonCode("LON:BP"), "BP");
  
  // "BP.L" (Yahoo style) -> "BP" (LON style)
  assert.equal(Core.extractLonCode("BP.L"), "BP");
});

test("GAP: Tradingview Israeli fund fallback parity", () => {
  // Current implementation (line 8 in tradingview-fund.ts) handles .TA -> TASE:
  // But we need to ensure it matches legacy's hf_normalizeTradingviewCodeForExchange_ behavior.
  const info = buildIsraeliFundTradingviewFallbackInfo("123456.TA");
  assert.equal(info.expectedSymbol, "TASE:123456");
});
