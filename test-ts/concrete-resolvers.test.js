const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  FunctionValueResolver,
  RequestInput,
} = require("../dist/ts/core/index.js");

function createRequestInput(overrides = {}) {
  return new RequestInput({
    attribute: overrides.attribute || "price",
    attributeRequest: {
      baseAttribute: overrides.attributeType === "isin" ? "isin" : "price",
      outputCode: "",
      rawAttribute: overrides.attribute || "price",
      wantsOutputCurrency: false,
    },
    attributeType: overrides.attributeType || "quote",
    classification: overrides.classification || "equity",
    fxPair: overrides.fxPair || null,
    identifier: overrides.identifier || "GOOG",
    infoMode: overrides.infoMode || "",
    sourceOverride: overrides.sourceOverride || "",
    ticker: overrides.ticker || overrides.identifier || "GOOG",
    upperTicker: (
      overrides.ticker ||
      overrides.identifier ||
      "GOOG"
    ).toUpperCase(),
  });
}

test("DirectIdentifierResolver resolves direct non-ISIN requests into typed requests", () => {
  const resolver = new DirectIdentifierResolver({
    buildTypedRequestFromParsedInput(originalInput, parsedInput, identifierResolutionMs) {
      return {
        classification: "equity",
        identifierResolutionMs,
        input: {
          attribute: originalInput.attribute,
          identifier: originalInput.identifier,
        },
        requestType: "equity",
        symbol: parsedInput.ticker,
        yahooSymbol: parsedInput.ticker,
      };
    },
    extractIsinFromRequestInput(input) {
      return String(input.ticker).startsWith("US") ? input.upperTicker : "";
    },
  });

  const success = resolver.resolve(createRequestInput({ ticker: "GOOG" }));
  assert.equal(success.status, "success");
  assert.equal(success.value.yahooSymbol, "GOOG");
  assert.ok(success.value.identifierResolutionMs >= 0);

  const failure = resolver.resolve(
    createRequestInput({
      identifier: "US02079K1079",
      ticker: "US02079K1079",
    }),
  );
  assert.equal(failure.status, "failure");
  assert.match(failure.error, /requires a discovery resolver/);
});

test("FunctionValueResolver executes resolved job callbacks and materializes from refs", () => {
  const resolver = FunctionValueResolver.fromSpec(
    "DIRECT",
    {
      options: {
        routingDescription: "Direct lookup",
      },
      resolveFunctionRef: "DIRECT",
      resolverClass: "FunctionValueResolver",
    },
    {
      resolveFunctionsByRef: {
        DIRECT(job) {
          return String(job.routeState.isin || "").toUpperCase();
        },
      },
    },
  );

  assert.equal(resolver.routingDescription, "Direct lookup");

  const results = resolver.executeBatch([
    {
      routeState: { isin: "us02079k1079" },
    },
  ]);

  assert.deepEqual(results, [
    {
      status: "success",
      value: "US02079K1079",
    },
  ]);

  assert.throws(
    () =>
      FunctionValueResolver.fromSpec(
        "DIRECT",
        {
          resolveFunctionRef: "MISSING",
          resolverClass: "FunctionValueResolver",
        },
        {
          resolveFunctionsByRef: {},
        },
      ),
    /Unknown resolver function ref "MISSING" for "DIRECT"\./,
  );
});
