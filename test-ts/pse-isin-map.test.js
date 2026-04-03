const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolvePseTickerFromLookupMap,
} = require("../dist/ts/core/index.js");

test("resolvePseTickerFromLookupMap preserves the runtime's PH-only lookup behavior", () => {
  assert.equal(
    resolvePseTickerFromLookupMap("PHY077751022", {
      PHY077751022: "PSE:BDO",
    }),
    "PSE:BDO",
  );
  assert.equal(
    resolvePseTickerFromLookupMap("US02079K1079", {
      US02079K1079: "NASDAQ:GOOG",
    }),
    "",
  );
});
