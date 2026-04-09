const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatEnvelopeResult,
  formatLookupResult,
  lookupEnvelopeWithEnvironment,
  lookupWithEnvironment,
  runSmokeSuite,
} = require("../tools/_shared/cli-ts.js");

function createFakeLookupEnv() {
  return {
    lookup(identifier, attribute) {
      const ticker = String(identifier || "").trim().toUpperCase();
      const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();

      if (ticker === "GOOG") {
        return {
          attemptedRoutes: ["DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
          route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
          status: "success",
          value: normalizedAttribute === "isin" ? "US02079K1079" : 123.45,
        };
      }

      if (ticker === "EURUSD") {
        return {
          attemptedRoutes: ["DEFAULT-ATTRIBUTE:FX", "QUOTE:DEFAULT-FX"],
          route: "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX",
          status: "success",
          value: 1.25,
        };
      }

      if (ticker === "USDUSD") {
        return {
          attemptedRoutes: ["DEFAULT-ATTRIBUTE:FX", "FX-IDENTITY"],
          route: "DEFAULT-ATTRIBUTE:FX -> FX-IDENTITY",
          status: "success",
          value: 1,
        };
      }

      if (ticker === "US02079K1079" || ticker === "PHY077751022") {
        return {
          attemptedRoutes: ["IDENTIFIER-ROOT", "DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
          route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
          status: "success",
          value: 123.45,
        };
      }

      if (ticker === "TLV:KSMF59" || ticker === "PSE:BDO") {
        return {
          attemptedRoutes: ["DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
          route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
          status: "success",
          value: ticker === "TLV:KSMF59" ? 17.25 : 9.87,
        };
      }

      return {
        attemptedRoutes: ["DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
        error: `not found: ${ticker}`,
        route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
        status: "failure",
      };
    },
    lookupEnvelope(identifier, attribute) {
      const ticker = String(identifier || "").trim().toUpperCase();
      const normalizedAttribute = String(attribute == null ? "price" : attribute).trim();

      return {
        attemptedRoutes: ["DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
        kind: "quote",
        route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
        status: "success",
        value: {
          attribute: normalizedAttribute,
          regularMarketPrice: ticker === "TLV:KSMF59" ? 17.25 : 123.45,
          symbol: ticker,
        },
      };
    },
    resolveAttribute(identifier, attribute) {
      return this.lookup(identifier, attribute).value;
    },
  };
}

test("lookupWithEnvironment normalizes the attribute and delegates to env.lookup", () => {
  let receivedArgs = null;
  const env = {
    lookup(identifier, attribute) {
      receivedArgs = { attribute, identifier };
      return {
        route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
        status: "success",
        value: 123.45,
      };
    },
  };

  const result = lookupWithEnvironment(env, {
    attribute: "  price  ",
    ticker: "GOOG",
  });

  assert.deepEqual(receivedArgs, {
    attribute: "price",
    identifier: "GOOG",
  });
  assert.equal(result.value, 123.45);
});

test("lookupEnvelopeWithEnvironment normalizes the attribute and delegates to env.lookupEnvelope", () => {
  let receivedArgs = null;
  const env = {
    lookupEnvelope(identifier, attribute) {
      receivedArgs = { attribute, identifier };
      return {
        kind: "quote",
        route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
        status: "success",
        value: {
          regularMarketPrice: 17.25,
        },
      };
    },
  };

  const result = lookupEnvelopeWithEnvironment(env, {
    attribute: "  price  ",
    ticker: "TLV:KSMF59",
  });

  assert.deepEqual(receivedArgs, {
    attribute: "price",
    identifier: "TLV:KSMF59",
  });
  assert.equal(result.value.regularMarketPrice, 17.25);
});

test("lookup formatting returns primitive and null results cleanly", () => {
  assert.equal(
    formatLookupResult({
      route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
      status: "success",
      value: 123.45,
    }),
    123.45,
  );
  assert.equal(
    formatLookupResult({
      error: "not found",
      route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
      status: "failure",
    }),
    null,
  );
});

test("envelope formatting preserves object payloads", () => {
  const output = formatEnvelopeResult({
    attemptedRoutes: ["DEFAULT-ATTRIBUTE:EQUITY", "QUOTE:TICKER"],
    kind: "quote",
    route: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER",
    status: "success",
    value: {
      regularMarketPrice: 17.25,
      symbol: "TLV:KSMF59",
    },
  });

  assert.match(output, /"value": \{/m);
  assert.match(output, /"regularMarketPrice": 17\.25/m);
});

test("runSmokeSuite validates the supported CLI smoke cases", () => {
  const smoke = runSmokeSuite(createFakeLookupEnv());

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});
