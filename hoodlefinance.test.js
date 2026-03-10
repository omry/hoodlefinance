const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function loadHoodlefinance() {
  const source = fs.readFileSync(path.join(__dirname, "hoodlefinance.js"), "utf8");
  const cacheStore = new Map();
  const sandbox = {
    console,
    Date,
    JSON,
    encodeURIComponent,
    Array,
    String,
    Object,
    RegExp,
    Error,
    Map,
    CacheService: {
      getScriptCache() {
        return {
          get(key) {
            return cacheStore.has(key) ? cacheStore.get(key) : null;
          },
          put(key, value) {
            cacheStore.set(key, value);
          },
        };
      },
    },
    UrlFetchApp: {
      fetch() {
        throw new Error("Unexpected fetch in test");
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

test("normalizes GOOGLEFINANCE-style tickers to Yahoo symbols", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceNormalizeTicker_("LON:ISJP"), "ISJP.L");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("ETR:ZPRX"), "ZPRX.DE");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("NASDAQ:GOOG"), "GOOG");
  assert.equal(ctx.hoodlefinanceNormalizeTicker_("CURRENCY:EURUSD"), "EURUSD=X");
});

test("maps Yahoo exchange codes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("LON:ISJP", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ETR:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("NASDAQ:GOOG", "GOOG"), "NASDAQ");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("NYSE:IBM", "IBM"), "NYSE");
});

test("maps Yahoo suffixes to IBKR exchange hints", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ISJP.L", "ISJP.L"), "LSEETF");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("ZPRV.DE", "ZPRV.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("IUVL.L", "IUVL.L"), "LSEETF");
});

test("explicit IBKR exchange codes override Yahoo-derived mapping", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("IBIS:ZPRX", "ZPRX.DE"), "IBIS");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("LSEETF:ISJP", "ISJP.L"), "LSEETF");
});

test("unsupported or unmapped exchanges fall back to blank hint", () => {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("SHA:600519", "600519.SS"), "");
  assert.equal(ctx.hoodlefinanceInferIbkrExchange_("UNKNOWN:FOO", "FOO"), "");
});

test("extracts IBKR detail URLs and de-duplicates matches", () => {
  const ctx = loadHoodlefinance();
  const html = [
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=123&amp;site=GEN$exchangeLSEETF">',
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=123&amp;site=GEN$exchangeLSEETF">',
    '<a href="/cstools/contract_info/index.php?action=Details&amp;conid=456&amp;site=GEN$exchangeIBIS">',
  ].join("\n");

  const entries = ctx.hoodlefinanceExtractIbkrDetailUrls_(html);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=123&site=GEN");
  assert.equal(entries[1].url, "https://misc.interactivebrokers.com/cstools/contract_info/index.php?action=Details&conid=456&site=GEN");
});

test("sorts IBKR detail entries to prefer the requested exchange", () => {
  const ctx = loadHoodlefinance();
  const entries = [
    { exchangeHint: "IBIS", url: "ibis" },
    { exchangeHint: "LSEETF", url: "lse" },
    { exchangeHint: "", url: "other" },
  ];

  ctx.hoodlefinanceSortIbkrDetailEntries_(entries, "LSEETF");

  assert.deepEqual(
    entries.map((entry) => entry.url),
    ["lse", "ibis", "other"]
  );
});

test("money normalization converts GBp prices to GBP", () => {
  const ctx = loadHoodlefinance();
  const quote = { currency: "GBp" };

  assert.equal(ctx.hoodlefinanceNormalizeMoney_(quote, 1234), 12.34);
  assert.equal(ctx.hoodlefinanceNormalizeCurrency_("GBp"), "GBP");
});

test("attribute extraction uses context-aware isin resolver", () => {
  const ctx = loadHoodlefinance();
  let capturedArgs = null;

  ctx.hoodlefinanceResolveIbkrIsin_ = function (quote, context) {
    capturedArgs = { quote, context };
    return "TESTISIN123";
  };

  const result = ctx.hoodlefinanceExtractAttribute_(
    { symbol: "ISJP.L" },
    "isin",
    { tickerInput: "LON:ISJP" }
  );

  assert.equal(result, "TESTISIN123");
  assert.deepEqual(capturedArgs, {
    quote: { symbol: "ISJP.L" },
    context: { tickerInput: "LON:ISJP" },
  });
});
