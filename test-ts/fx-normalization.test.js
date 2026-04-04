const assert = require("node:assert/strict");
const test = require("node:test");

const { parseFxTicker } = require("../dist/ts/core/index.js");

test("ambiguous bare 4-character FX candidates do not auto-parse as currency pairs (Strict Parity)", () => {
  assert.throws(
    () => parseFxTicker("USDTUSD"),
    /Currency ticker "USDTUSD" is ambiguous\. Use CURRENCY:USD\.TUSD or CURRENCY:USDT\.USD\./,
  );
});

test("ambiguous compact prefixed FX tickers require dotted CURRENCY syntax", () => {
  assert.throws(
    () => parseFxTicker("CURRENCY:USDTUSD"),
    /Currency ticker "CURRENCY:USDTUSD" is ambiguous\. Use CURRENCY:USD\.TUSD or CURRENCY:USDT\.USD\./,
  );
});

test("bare FX pairs use canonical Google quotes with alias-aware scaling", () => {
  const pair = parseFxTicker("GBpUSD");
  assert.ok(pair);
  assert.equal(pair.baseCanonicalCode, "GBP");
  assert.equal(pair.quoteCanonicalCode, "USD");
  assert.equal(pair.scale, 0.01);
});

test("crypto-fiat pairs use dash-separated Yahoo symbols", () => {
  const pair = parseFxTicker("BTCUSD");
  assert.ok(pair);
  assert.equal(pair.yahooChartSymbol, "BTC-USD");
  assert.equal(pair.yahooSymbol, "BTCUSD=X");
});

test("same-currency FX pairs short-circuit", () => {
  const pair = parseFxTicker("CURRENCY:USDUSD");
  assert.ok(pair);
  assert.equal(pair.isSameCurrency, true);
  assert.equal(pair.scale, 1);
});

test("invalid and unsupported FX tickers throw", () => {
  assert.throws(() => parseFxTicker("CURRENCY:NOT-A-PAIR"), /must look like CURRENCY:USDEUR or CURRENCY:USDT\.USD/);
  assert.throws(() => parseFxTicker("CURRENCY:ZZZ.USD"), /must use supported 3- or 4-character currency codes/);
});
