const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveAttributeResultWithEnvironment,
  runSmokeSuite,
} = require("../tools/_shared/cli-ts.js");

function createFakeLookupEnv() {
  return {
    resolveAttribute(identifier, attribute) {
      const ticker = String(identifier || "").trim().toUpperCase();
      const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();

      if (ticker === "GOOG") {
        return normalizedAttribute === "isin" ? "US02079K1079" : 123.45;
      }

      if (ticker === "EURUSD") {
        return 1.25;
      }

      if (ticker === "USDUSD") {
        return 1;
      }

      if (ticker === "US02079K1079" || ticker === "PHY077751022") {
        return 123.45;
      }

      if (ticker === "TLV:KSMF59" || ticker === "PSE:BDO") {
        return ticker === "TLV:KSMF59" ? 17.25 : 9.87;
      }

      throw new Error(`not found: ${ticker}`);
    },
  };
}

test("resolveAttributeResultWithEnvironment normalizes the attribute and delegates to env.resolveAttribute", () => {
  let receivedArgs = null;
  const env = {
    resolveAttribute(identifier, attribute) {
      receivedArgs = { attribute, identifier };
      return 123.45;
    },
  };

  const result = resolveAttributeResultWithEnvironment(env, {
    attribute: "  price  ",
    ticker: "GOOG",
  });

  assert.deepEqual(receivedArgs, {
    attribute: "price",
    identifier: "GOOG",
  });
  assert.equal(result.status, "success");
  assert.equal(result.value, 123.45);
});

test("runSmokeSuite validates the supported CLI smoke cases", () => {
  const smoke = runSmokeSuite(createFakeLookupEnv());

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});
