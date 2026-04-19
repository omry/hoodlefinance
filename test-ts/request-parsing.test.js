const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractTickerInfoMode,
  extractTickerSourceOverride,
  normalizeAttribute,
  parseAttributeRequest,
  parseTickerRequest,
  stripTickerSourceOverride,
} = require("../dist/ts/core/index.js");

test("normalizeAttribute defaults blankish inputs to price", () => {
  assert.equal(normalizeAttribute(undefined), "price");
  assert.equal(normalizeAttribute(null), "price");
  assert.equal(normalizeAttribute(""), "price");
  assert.equal(normalizeAttribute("  "), "price");
  assert.equal(normalizeAttribute(" close "), "close");
});

test("parseAttributeRequest keeps the current converted-attribute contract", () => {
  assert.deepEqual(parseAttributeRequest("price"), {
    baseAttribute: "price",
    outputCode: "",
    rawAttribute: "price",
    wantsOutputCurrency: false,
  });

  assert.deepEqual(parseAttributeRequest("price@USD"), {
    baseAttribute: "price",
    outputCode: "USD",
    rawAttribute: "price@USD",
    wantsOutputCurrency: true,
  });

  assert.throws(
    () => parseAttributeRequest("price@"),
    /Converted attributes must look like price@USD\./,
  );
});

test("parseTickerRequest distinguishes explicit source suffixes from info modes", () => {
  assert.deepEqual(parseTickerRequest("BTCUSD@YAHOO"), {
    infoMode: "source-override",
    ticker: "BTCUSD",
  });

  assert.deepEqual(parseTickerRequest("BTCUSD@?"), {
    infoMode: "source-name",
    ticker: "BTCUSD",
  });

  assert.deepEqual(parseTickerRequest("BTCUSD@"), {
    infoMode: "source-list",
    ticker: "BTCUSD",
  });

  assert.deepEqual(parseTickerRequest("BTCUSD@MYSTERY"), {
    infoMode: "source-override",
    ticker: "BTCUSD",
  });
});

test("ticker parsing helpers strip suffixes consistently", () => {
  assert.equal(extractTickerSourceOverride("PSE:BDO@PSE-FRAMES"), "PSE-FRAMES");
  assert.equal(extractTickerInfoMode("BTCUSD@?"), "source-name");
  assert.equal(
    stripTickerSourceOverride("ISIN:US02079K1079@YAHOO"),
    "ISIN:US02079K1079",
  );
});
