const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  FunctionValueResolver,
  LocalFxResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  FxRequest,
  RequestInput,
  createConcreteResolverMaterializationDependencies,
  getMaterializedResolverByCode,
  getRegisteredResolverByName,
  materializeResolversByCode,
} = require("../dist/ts/core/index.js");

class FakeResolver {
  constructor(code, label, name) {
    this.code = code;
    this.name = name || code;
    this.routingDescription = label;
    this.routingLabel = code;
    this.sourceName = code;
  }

  canHandle() {
    return true;
  }

  buildRuntimePlan() {
    return { nodes: [this], routeClass: this.name, routePath: this.name, routeState: {} };
  }

  describe() {
    return this.name;
  }

  static fromSpec(code, spec) {
    return new this(
      code,
      spec.options?.routingDescription || "",
      spec.options?.materializedName || code,
    );
  }
}

test("materializeResolversByCode instantiates and registers resolvers by class name", () => {
  const registry = materializeResolversByCode(
    {
      YAHOO: {
        options: {
          materializedName: "YAHOO-LOOKUP",
          routingDescription: "Yahoo quote lookup",
        },
        resolverClass: "FakeResolver",
      },
    },
    {
      resolverClassesByName: {
        FakeResolver,
      },
    },
  );

  const resolver = getMaterializedResolverByCode(registry, "yahoo");
  assert.equal(registry.byCode.YAHOO, resolver);
  assert.equal(getRegisteredResolverByName(registry.byName, "YAHOO-LOOKUP"), resolver);
  assert.equal(resolver?.name, "YAHOO-LOOKUP");
  assert.equal(registry.byCode.YAHOO?.routingDescription, "Yahoo quote lookup");
});

test("materializeResolversByCode rejects unknown class names", () => {
  assert.throws(
    () =>
      materializeResolversByCode(
        {
          YAHOO: {
            resolverClass: "MissingResolver",
          },
        },
        {
          resolverClassesByName: {},
        },
      ),
    /Unknown resolver class "MissingResolver" for "YAHOO"\./,
  );
});

test("materializeResolversByCode can instantiate concrete resolvers with class-specific dependencies", () => {
  const registry = materializeResolversByCode(
    {
      DIRECT: {
        resolveFunctionRef: "DIRECT",
        resolverClass: "FunctionValueResolver",
      },
      "DIRECT-IDENTIFIER": {
        resolverClass: "DirectIdentifierResolver",
      },
      LOCAL: {
        resolverClass: "LocalFxResolver",
      },
      "PSE-MAP": {
        resolverClass: "PseIsinMapResolver",
      },
      "YAHOO-ISIN": {
        resolverClass: "YahooIsinSearchResolver",
      },
      GOOGLE: {
        resolverClass: "GoogleFxResolver",
      },
    },
    createConcreteResolverMaterializationDependencies({
      resolveFunctionsByRef: {
        DIRECT(job) {
          return String(job.routeState.identifier || "").toUpperCase();
        },
      },
      resolvePseTickerFromIsinMap(isin) {
        return isin === "PHY077751022" ? "PSE:BDO" : "";
      },
      yahooIsinSearch: {
        fetchAllInChunks(_source, requests) {
          return requests.map((request) => ({
            request,
            response: {
              getContentText() {
                return JSON.stringify({
                  quotes: [{ symbol: "IBM", quoteType: "EQUITY", score: 1 }],
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
        putCachedString(_cacheKey, value) {
          return value;
        },
      },
      googleFx: {
        fetchText(url) {
          assert.equal(url, "https://www.google.com/finance/quote/EUR-USD");
          return `AF_initDataCallback({data:${JSON.stringify([
            [
              "EUR-USD",
              null,
              null,
              null,
              null,
              [1.25, 0.01],
              null,
              1.24,
              null,
              null,
              null,
              [1700000000],
              null,
              null,
              null,
              ["EUR", "USD", "Euro"],
            ],
          ])},sideChannel:{}});</script>`;
        },
        getCachedJson() {
          return null;
        },
        putCachedJson(_cacheKey, value) {
          return value;
        },
      },
    }),
  );

  assert.equal(registry.byCode.DIRECT instanceof FunctionValueResolver, true);
  assert.equal(
    registry.byCode["DIRECT-IDENTIFIER"] instanceof DirectIdentifierResolver,
    true,
  );
  assert.equal(registry.byCode.LOCAL instanceof LocalFxResolver, true);
  assert.equal(registry.byCode.GOOGLE instanceof GoogleFxResolver, true);
  assert.equal(registry.byCode["PSE-MAP"] instanceof PseIsinMapResolver, true);
  assert.equal(
    registry.byCode["YAHOO-ISIN"] instanceof YahooIsinSearchResolver,
    true,
  );
  assert.equal(
    registry.byCode.DIRECT.executeBatch([{ routeState: { identifier: "goog" } }])[0].value,
    "GOOG",
  );

  const resolved = registry.byCode["DIRECT-IDENTIFIER"].resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "equity",
      fxPair: null,
      identifier: "GOOG",
      infoMode: "",
      sourceOverride: "",
      ticker: "GOOG",
      upperTicker: "GOOG",
    }),
  );

  assert.equal(resolved.status, "success");
  assert.equal(resolved.value.yahooSymbol, "GOOG");

  const pseResolved = registry.byCode["PSE-MAP"].resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "isin",
      fxPair: null,
      identifier: "ISIN:PHY077751022",
      infoMode: "",
      sourceOverride: "",
      ticker: "ISIN:PHY077751022",
      upperTicker: "ISIN:PHY077751022",
    }),
  );

  assert.equal(pseResolved.status, "success");
  assert.equal(pseResolved.value.exchange, "PSE");

  const yahooResolved = registry.byCode["YAHOO-ISIN"].resolve(
    new RequestInput({
      attribute: "price",
      attributeRequest: {
        baseAttribute: "price",
        outputCode: "",
        rawAttribute: "price",
        wantsOutputCurrency: false,
      },
      attributeType: "quote",
      classification: "isin",
      fxPair: null,
      identifier: "ISIN:US4592001014",
      infoMode: "",
      sourceOverride: "",
      ticker: "ISIN:US4592001014",
    }),
  );

  assert.equal(yahooResolved.status, "success");
  assert.equal(yahooResolved.value.yahooSymbol, "IBM");

  const googleResolved = registry.byCode.GOOGLE.resolve(
    new FxRequest({
      attribute: "price",
      fxPair: {
        baseCanonicalCode: "EUR",
        baseDisplayCode: "EUR",
        canonicalPair: "EURUSD",
        displayQuoteCode: "USD",
        googlePairSlug: "EUR-USD",
        googleSymbol: "CURRENCY:EURUSD",
        isSameCurrency: false,
        pairDisplay: "EURUSD",
        quoteCanonicalCode: "USD",
        quoteDisplayCode: "USD",
        scale: 1,
        yahooChartSymbol: "EURUSD=X",
      },
      identifier: "EURUSD",
      identifierResolutionMs: 0,
    }),
  );

  assert.equal(googleResolved.status, "success");
  assert.equal(googleResolved.value.regularMarketPrice, 1.25);
  assert.equal(
    googleResolved.value.hoodlefinanceFxGoogleSymbol,
    "CURRENCY:EURUSD",
  );
});
