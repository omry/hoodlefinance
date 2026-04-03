const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractYahooExchangeFromSymbol,
  normalizeExplicitIbkrExchange,
  resolveExchangeSuffix,
} = require("../dist/ts/core/index.js");

test("exchange symbol data tables preserve copied runtime aliases", () => {
  assert.equal(resolveExchangeSuffix("PAR"), ".PA");
  assert.equal(resolveExchangeSuffix("EPA"), ".PA");
  assert.equal(extractYahooExchangeFromSymbol("BNP.PA"), "PAR");
  assert.equal(normalizeExplicitIbkrExchange("SFB"), "SFB");
});
