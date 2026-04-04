const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeTickerWithoutIsin } = require("../dist/ts/core/index.js");

test("normalizes GOOGLEFINANCE-style tickers to Yahoo symbols", () => {
  assert.equal(normalizeTickerWithoutIsin("LON:ISJP"), "ISJP.L");
  assert.equal(normalizeTickerWithoutIsin("ETR:ZPRX"), "ZPRX.DE");
  assert.equal(normalizeTickerWithoutIsin("NEO:ZTL"), "ZTL.NE");
  assert.equal(normalizeTickerWithoutIsin("SGX:D05"), "D05.SI");
  assert.equal(normalizeTickerWithoutIsin("TLV:POLI"), "POLI.TA");
  assert.equal(normalizeTickerWithoutIsin("TLV:KSM.F59"), "KSM.F59.TA");
  assert.equal(normalizeTickerWithoutIsin("TLV:KSMF59"), "KSM.F59.TA");
  assert.equal(normalizeTickerWithoutIsin("TASE:KSMF59"), "KSM.F59.TA");
  assert.equal(normalizeTickerWithoutIsin("NASDAQ:GOOG"), "GOOG");
  assert.equal(normalizeTickerWithoutIsin("USDPHP"), "USDPHP=X");
  assert.equal(normalizeTickerWithoutIsin("BTCUSD"), "BTCUSD=X");
  assert.equal(normalizeTickerWithoutIsin("CURRENCY:ETHUSD"), "ETHUSD=X");
  assert.equal(normalizeTickerWithoutIsin("GBpUSD"), "GBPUSD=X");
  assert.equal(normalizeTickerWithoutIsin("USDILA"), "USDILS=X");
  assert.equal(normalizeTickerWithoutIsin("CURRENCY:EURUSD"), "EURUSD=X");
  assert.equal(normalizeTickerWithoutIsin("CURRENCY:USDUSD"), "USDUSD=X");
  assert.equal(normalizeTickerWithoutIsin("DOGEUSD"), "DOGEUSD=X");
  assert.equal(normalizeTickerWithoutIsin("USDUSDT"), "USDUSDT=X");
  assert.equal(normalizeTickerWithoutIsin("USDCUSDT"), "USDCUSDT=X");
  assert.equal(normalizeTickerWithoutIsin("CURRENCY:USDT.USD"), "USDTUSD=X");
  assert.equal(normalizeTickerWithoutIsin("FOOUSD"), "FOOUSD");
});

test("normalizes Yahoo-style Israeli fund tickers to canonical dotted forms", () => {
  assert.equal(normalizeTickerWithoutIsin("KSMF59.TA"), "KSM.F59.TA");
  assert.equal(normalizeTickerWithoutIsin("KSM.F59.TA"), "KSM.F59.TA");
});

test("TLV fund aliases normalize to dotted Yahoo symbols in quote lookups", () => {
  assert.equal(normalizeTickerWithoutIsin("TLV:KSMF59"), "KSM.F59.TA");
});

test("bare tickers fall back to Israeli fund normalization", () => {
  assert.equal(normalizeTickerWithoutIsin("KSMF59.TA"), "KSM.F59.TA");
  assert.equal(normalizeTickerWithoutIsin("GOOG"), "GOOG");
});

test("prefixless exchanges return the symbol directly", () => {
  assert.equal(normalizeTickerWithoutIsin("NASDAQ:GOOG"), "GOOG");
  assert.equal(normalizeTickerWithoutIsin("NYSE:IBM"), "IBM");
});

test("invalid ticker formats throw", () => {
  assert.throws(() => normalizeTickerWithoutIsin("PSE:"), /Ticker "PSE:" is invalid\./);
  assert.throws(() => normalizeTickerWithoutIsin("PDA:BDO"), /Unsupported exchange prefix "PDA" in ticker "PDA:BDO"\./);
});
