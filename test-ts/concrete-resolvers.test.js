const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  FunctionValueResolver,
  LocalFxResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  RequestInput,
  FxRequest,
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
  const resolver = new DirectIdentifierResolver();

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

test("LocalFxResolver returns a same-currency synthetic quote", () => {
  const resolver = new LocalFxResolver();
  const request = new FxRequest({
    attribute: "price",
    fxPair: {
      baseCanonicalCode: "USD",
      canonicalPair: "USDUSD",
      displayQuoteCode: "USD",
      googleSymbol: "CURRENCY:USDUSD",
      isSameCurrency: true,
      pairDisplay: "USDUSD",
      quoteCanonicalCode: "USD",
      scale: 1,
      yahooChartSymbol: "USDUSD=X",
    },
    identifier: "USDUSD",
    identifierResolutionMs: 0,
  });

  assert.equal(resolver.canHandle(request), true);
  assert.deepEqual(resolver.buildRouteState(request), {
    fxPair: request.fxPair,
  });

  const results = resolver.executeBatch([{ routeState: { fxPair: request.fxPair } }]);
  assert.equal(results[0].status, "success");
  assert.equal(results[0].quote.regularMarketPrice, 1);
  assert.equal(results[0].quote.symbol, "USDUSD");
});

test("PseIsinMapResolver resolves Philippine ISIN inputs through the map lookup", () => {
  const resolver = new PseIsinMapResolver((isin) =>
    isin === "PHY077751022" ? "PSE:BDO" : "",
  );
  const requestInput = createRequestInput({
    attribute: "price",
    attributeType: "quote",
    classification: "isin",
    identifier: "ISIN:PHY077751022",
    ticker: "ISIN:PHY077751022",
  });

  assert.equal(resolver.canHandle(requestInput), true);
  assert.deepEqual(resolver.getAttributeOverrideSources(requestInput), ["PSE"]);

  const success = resolver.resolve(requestInput);
  assert.equal(success.status, "success");
  assert.equal(success.value.exchange, "PSE");
  assert.equal(success.value.symbol, "BDO");

  const failure = resolver.resolve(
    createRequestInput({
      attribute: "price",
      attributeType: "quote",
      classification: "isin",
      identifier: "ISIN:US02079K1079",
      ticker: "ISIN:US02079K1079",
    }),
  );
  assert.equal(failure.status, "failure");
});

test("YahooIsinSearchResolver resolves cached and fetched Yahoo ISIN lookups", () => {
  const cachedResolver = new YahooIsinSearchResolver({
    fetchAllInChunks(_source, requests) {
      assert.deepEqual(requests, []);
      return [];
    },
    getCachedString(cacheKey) {
      return cacheKey === "hoodlefinance:isin:US02079K1079" ? "GOOG" : "";
    },
    putCachedString(value) {
      return value;
    },
  });
  const cachedRequest = createRequestInput({
    attribute: "price",
    attributeType: "quote",
    classification: "isin",
    identifier: "ISIN:US02079K1079",
    ticker: "ISIN:US02079K1079",
  });

  assert.equal(cachedResolver.canHandle(cachedRequest), true);
  assert.deepEqual(cachedResolver.getAttributeOverrideSources(cachedRequest), [
    "YAHOO",
  ]);

  const cachedResult = cachedResolver.resolve(cachedRequest);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.yahooSymbol, "GOOG");

  let cachedWrite = null;
  const fetchedResolver = new YahooIsinSearchResolver({
    fetchAllInChunks(_source, requests) {
      return requests.map((request) => ({
        request,
        response: {
          getContentText() {
            return JSON.stringify({
              quotes: [
                {
                  exchange: "NYSE",
                  quoteType: "EQUITY",
                  score: 10,
                  symbol: "IBM",
                },
              ],
            });
          },
          getResponseCode() {
            return 200;
          },
        },
      }));
    },
    getCachedString() {
      return "";
    },
    putCachedString(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  });

  const fetchedResult = fetchedResolver.resolve(cachedRequest);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.yahooSymbol, "IBM");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:isin:US02079K1079",
    ttlSeconds: 21600,
    value: "IBM",
  });
});
