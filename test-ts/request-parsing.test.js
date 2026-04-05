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

function isKnownSourceOverrideName(candidateSource) {
  return new Set(["IBKR", "PSE-EDGE", "PSE-FRAMES", "YAHOO"]).has(
    String(candidateSource || "")
      .trim()
      .toUpperCase(),
  );
}

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

test("parseTickerRequest preserves source-override and info-mode behavior", () => {
  assert.deepEqual(
    parseTickerRequest("BTCUSD@YAHOO", isKnownSourceOverrideName),
    {
      infoMode: "",
      sourceOverride: "YAHOO",
      ticker: "BTCUSD",
    },
  );

  assert.deepEqual(parseTickerRequest("BTCUSD@?", isKnownSourceOverrideName), {
    infoMode: "source-name",
    sourceOverride: "",
    ticker: "BTCUSD",
  });

  assert.deepEqual(parseTickerRequest("BTCUSD@", isKnownSourceOverrideName), {
    infoMode: "source-list",
    sourceOverride: "",
    ticker: "BTCUSD",
  });

  assert.deepEqual(
    parseTickerRequest("BTCUSD@MYSTERY", isKnownSourceOverrideName),
    {
      infoMode: "source-list",
      sourceOverride: "",
      ticker: "BTCUSD",
    },
  );
});

test("ticker override helpers match the parsed ticker contract", () => {
  assert.equal(
    extractTickerSourceOverride(
      "PSE:BDO@PSE-FRAMES",
      isKnownSourceOverrideName,
    ),
    "PSE-FRAMES",
  );
  assert.equal(
    extractTickerInfoMode("BTCUSD@?", isKnownSourceOverrideName),
    "source-name",
  );
  assert.equal(
    stripTickerSourceOverride(
      "ISIN:US02079K1079@YAHOO",
      isKnownSourceOverrideName,
    ),
    "ISIN:US02079K1079",
  );
});
