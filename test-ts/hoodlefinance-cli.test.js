const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createCliEnvironment,
  formatLookupResult,
  formatEnvelopeResult,
  formatTraceOutput,
  formatRoutingTable,
  formatRoutingTree,
  lookupEnvelopeWithEnvironment,
  lookupWithEnvironment,
  runSmokeSuite,
} = require("../tools/_shared/cli-ts.js");
const { createRequestInput } = require("../dist/ts/core/request-building.js");
const { EquityRequest, FxRequest } = require("../dist/ts/core/request.js");

function createFakeEnvironment() {
  const env = createCliEnvironment();
  const resolverRegistries = [env.resolversByCode];
  const setResolverOverride = (code, applyOverride) => {
    for (const resolverRegistry of resolverRegistries) {
      const resolver = resolverRegistry[code];
      if (resolver) {
        applyOverride(resolver);
      }
    }
  };

  setResolverOverride("RESOLVED-IDENTIFIER", (resolver) => {
    resolver.resolve = function resolve(request) {
      const ticker = String((request && request.ticker) || "")
        .trim()
        .toUpperCase();

      if (
        !request ||
        ticker.startsWith("ISIN:") ||
        /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(ticker)
      ) {
        return {
          elapsedMs: 0,
          error: "not found",
          status: "failure",
        };
      }

      if (ticker === "PSE:EDGE") {
        return {
          elapsedMs: 0,
          status: "success",
          value: new EquityRequest({
            allowTradingviewFallback: false,
            attribute: request.attribute,
            exchange: "PSE",
            identifier: request.identifier,
            symbol: "EDGE",
            yahooSymbol: "EDGE.PS",
          }),
        };
      }

      if (ticker === "PSE:BDO") {
        return {
          elapsedMs: 0,
          status: "success",
          value: new EquityRequest({
            allowTradingviewFallback: false,
            attribute: request.attribute,
            exchange: "PSE",
            identifier: request.identifier,
            symbol: "BDO",
            yahooSymbol: "BDO.PS",
          }),
        };
      }

      if (ticker === "TLV:KSMF59") {
        return {
          elapsedMs: 0,
          status: "success",
          value: new EquityRequest({
            allowTradingviewFallback: true,
            attribute: request.attribute,
            identifier: request.identifier,
            symbol: "KSMF59",
            yahooSymbol: "KSM.F59.TA",
          }),
        };
      }

      if (ticker === "EURUSD") {
        return {
          elapsedMs: 0,
          status: "success",
          value: new FxRequest({
            attribute: request.attribute,
            fxPair: {
              baseCanonicalCode: "EUR",
              quoteCanonicalCode: "USD",
              yahooChartSymbol: "EURUSD=X",
            },
            identifier: request.identifier,
          }),
        };
      }

      if (ticker === "USDUSD") {
        return {
          elapsedMs: 0,
          status: "success",
          value: new FxRequest({
            attribute: request.attribute,
            fxPair: {
              baseCanonicalCode: "USD",
              quoteCanonicalCode: "USD",
              isSameCurrency: true,
              yahooChartSymbol: "USDUSD=X",
            },
            identifier: request.identifier,
          }),
        };
      }

      return {
        elapsedMs: 0,
        status: "success",
        value: new EquityRequest({
          attribute: request.attribute,
          identifier: request.identifier,
          symbol: "GOOG",
          yahooSymbol: "GOOG",
        }),
      };
    };
  });

  env.httpFetch = function httpFetch(url) {
    if (
      String(url) ===
      "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties"
    ) {
      return "PHY077751022=PSE:BDO\n";
    }

    if (String(url).includes("tradingview.com/symbols/NASDAQ-GOOG/")) {
      return [
        '{"resolved_symbol":"NASDAQ:GOOG"}',
        '{"isin_displayed":"US02079K1079"}',
      ].join("");
    }

    throw new Error(`unexpected fetch: ${url}`);
  };

  setResolverOverride("GOOGLE-FX", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map(() => ({
        quote: {
          regularMarketPrice: 1.25,
          shortName: "EURUSD",
          symbol: "EURUSD",
        },
        status: "success",
      }));
  });

  setResolverOverride("FX-IDENTITY", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map(() => ({
        quote: {
          regularMarketPrice: 1,
          shortName: "USDUSD",
          symbol: "USDUSD",
        },
        status: "success",
      }));
  });

  setResolverOverride("PSE-FRAMES", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map(() => ({
        quote: {
          currency: "PHP",
          regularMarketPrice: 9.87,
          shortName: "BDO Unibank, Inc.",
          symbol: "BDO",
        },
        status: "success",
      }));
  });

  setResolverOverride("PSE-EDGE", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map(() => ({
        quote: {
          currency: "PHP",
          regularMarketPrice: 8.88,
          shortName: "Edge Corp",
          symbol: "EDGE",
        },
        status: "success",
      }));
  });

  setResolverOverride("ISIN:PSE", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map((job) => {
        const isin = String(
          job && job.routeState && job.routeState.isin ? job.routeState.isin : "",
        )
          .trim()
          .toUpperCase();

        return isin === "PHY077751022"
          ? {
              status: "success",
              value: new EquityRequest({
                allowTradingviewFallback: false,
                attribute: job.routeState.input.attribute,
                exchange: "PSE",
                identifier: job.routeState.input.identifier,
                symbol: "BDO",
                yahooSymbol: "BDO.PS",
              }),
            }
          : {
              error: "not found",
              status: "failure",
            };
      });
  });

  setResolverOverride("ISIN:YAHOO", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map((job) => {
        const ticker = String(
          job && job.routeState && job.routeState.isin ? job.routeState.isin : "",
        )
          .trim()
          .toUpperCase();

        return ticker === "US02079K1079"
          ? {
              status: "success",
              value: new EquityRequest({
                attribute: job.routeState.input.attribute,
                identifier: job.routeState.input.identifier,
                symbol: "GOOG",
                yahooSymbol: "GOOG",
              }),
            }
          : {
              error: "not found",
              status: "failure",
            };
      });
  });

  setResolverOverride("YAHOO", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map((job) => {
        const yahooSymbol = String(
          job && job.routeState && job.routeState.yahooSymbol
            ? job.routeState.yahooSymbol
            : "",
        )
          .trim()
          .toUpperCase();

        if (yahooSymbol === "KSM.F59.TA") {
          return {
            error: "not found",
            status: "lookup_failure",
          };
        }

        return {
          quote: {
            currency: "USD",
            exchangeName: "NMS",
            fullExchangeName: "NasdaqGS",
            regularMarketPrice: 123.45,
            symbol: "GOOG",
          },
          status: "success",
        };
      });
  });

  setResolverOverride("TRADINGVIEW-FUND", (resolver) => {
    resolver.executeBatch = (jobs) =>
      jobs.map(() => ({
        quote: {
          currency: "ILS",
          exchangeName: "TASE",
          financialCurrency: "ILS",
          longName: "KSM KSMF59",
          regularMarketPrice: 17.25,
          shortName: "KSMF59",
          symbol: "KSMF59.TA",
        },
        status: "success",
      }));
  });

  return env;
}

test("lookupWithEnvironment routes to the expected resolver family", () => {
  const env = createFakeEnvironment();

  const direct = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "GOOG",
  });
  assert.equal(direct.route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(direct.status, "success");
  assert.equal(direct.value, 123.45);

  const fx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "EURUSD",
  });
  assert.equal(fx.route, "DEFAULT-ATTRIBUTE:FX -> QUOTE:DEFAULT-FX");
  assert.equal(fx.status, "success");
  assert.equal(fx.value, 1.25);

  const sameCurrencyFx = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "USDUSD",
  });
  assert.equal(
    sameCurrencyFx.route,
    "DEFAULT-ATTRIBUTE:FX -> FX-IDENTITY",
  );
  assert.equal(sameCurrencyFx.status, "success");
  assert.equal(sameCurrencyFx.value, 1);

  const isin = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "US02079K1079",
  });
  assert.equal(isin.route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(isin.status, "success");
  assert.equal(isin.value, 123.45);

  const tradingview = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "TLV:KSMF59",
  });
  assert.equal(tradingview.route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(tradingview.status, "success");
  assert.equal(tradingview.value, 17.25);
});

test("lookupWithEnvironment resolves routed isin attributes", () => {
  const env = createFakeEnvironment();

  const tickerIsin = lookupWithEnvironment(env, {
    attribute: "isin",
    ticker: "GOOG",
  });
  assert.equal(tickerIsin.route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(tickerIsin.status, "success");
  assert.equal(tickerIsin.value, "US02079K1079");

  const directIsin = lookupWithEnvironment(env, {
    attribute: "isin",
    ticker: "ISIN:US02079K1079",
  });
  assert.equal(directIsin.route, "ATTRIBUTE-IDENTITY");
  assert.equal(directIsin.status, "success");
  assert.equal(directIsin.value, "US02079K1079");
});

test("lookupWithEnvironment falls through the real quote plan from PSE to ticker", () => {
  const env = createCliEnvironment();
  const resolverRegistries = [env.resolversByCode];

  for (const resolverRegistry of resolverRegistries) {
    resolverRegistry["PSE-FRAMES"].executeBatch = (jobs) =>
      jobs.map(() => ({
        error: "not found",
        status: "lookup_failure",
      }));
    resolverRegistry["PSE-EDGE"].executeBatch = (jobs) =>
      jobs.map(() => ({
        error: "not found",
        status: "lookup_failure",
      }));
    resolverRegistry["YAHOO"].executeBatch = (jobs) =>
      jobs.map(() => ({
        status: "success",
        quote: {
          currency: "USD",
          regularMarketPrice: 123.45,
          symbol: "GOOG",
        },
      }));
    resolverRegistry["TRADINGVIEW-FUND"].executeBatch = () => {
      throw new Error("unexpected tradingview fallback");
    };
  }

  const result = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "PSE:BDO",
  });

  assert.equal(
    result.route,
    "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE -> QUOTE:TICKER",
  );
  assert.equal(result.status, "success");
  assert.equal(result.value, 123.45);
});

test("lookup formatting and routing views stay readable", () => {
  const env = createFakeEnvironment();
  const result = lookupWithEnvironment(env, {
    attribute: "price",
    ticker: "GOOG",
  });
  const output = formatLookupResult(result);
  const traceOutput = formatTraceOutput("GOOG", result);

  assert.equal(output, 123.45);
  assert.match(traceOutput, /^symbol: GOOG$/m);
  assert.match(
    traceOutput,
    /^planned route: DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER$/m,
  );
  assert.match(traceOutput, /^result: success$/m);
  assert.match(formatRoutingTable(), /classification\texample\troute/);
  assert.match(formatRoutingTable(), /PSE:BDO/);
  assert.match(formatRoutingTree(), /^ROOT \[switch\]$/m);
  assert.match(formatRoutingTree(), /CLASSIFY-REQUEST/m);
  assert.match(formatRoutingTree(), /PSE-FRAMES - PSE frames quote lookup/);
});

test("CLI prefers the local Yahoo fallback symbol for whitelisted REITs", () => {
  const env = createCliEnvironment();
  const requestInput = createRequestInput("NLY-I", "price");
  const resolvePlan = env.buildResolvePlan(requestInput);
  const routeState = resolvePlan.attributePlan.buildRuntimePlan(
    resolvePlan.resolvedRequest,
  ).routeState;

  assert.equal(routeState.preferredYahooSymbol, "NLY-PI");
  assert.equal(routeState.yahooSymbol, "NLY-I");
});

test("lookupWithEnvironment keeps the original Google-style symbol for preferred REITs", () => {
  const env = createCliEnvironment();
  const resolverRegistries = [env.resolversByCode];

  for (const resolverRegistry of resolverRegistries) {
    resolverRegistry["YAHOO"].executeBatch = (jobs) =>
      jobs.map(() => ({
        status: "success",
        quote: {
          currency: "USD",
          exchangeName: "NYSE",
          regularMarketPrice: 24.78,
          symbol: "NLY-PI",
        },
      }));
  }

  assert.equal(
    lookupWithEnvironment(env, {
      attribute: "symbol:google",
      ticker: "NLY-I",
    }).value,
    "NLY-I",
  );
  assert.equal(
    lookupWithEnvironment(env, {
      attribute: "symbol:yahoo",
      ticker: "NLY-I",
    }).value,
    "NLY-PI",
  );
});

test("lookupEnvelopeWithEnvironment preserves the raw quote envelope", () => {
  const env = createFakeEnvironment();
  const envelope = lookupEnvelopeWithEnvironment(env, {
    attribute: "price",
    ticker: "TLV:KSMF59",
  });

  assert.equal(envelope.status, "success");
  assert.equal(envelope.kind, "quote");
  assert.equal(envelope.route, "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:TICKER");
  assert.equal(envelope.value.regularMarketPrice, 17.25);

  const output = formatEnvelopeResult(envelope);
  assert.match(output, /"value": \{/m);
  assert.match(output, /"regularMarketPrice": 17\.25/m);
});

test("lookup formatting returns null for failures", () => {
  const env = createFakeEnvironment();
  const output = formatLookupResult(
    lookupWithEnvironment(env, {
      attribute: "price",
      ticker: "GOOG@YAHOO",
    }),
  );

  assert.equal(output, null);
});

test("runSmokeSuite validates the supported CLI smoke paths", () => {
  const env = createFakeEnvironment();
  const smoke = runSmokeSuite(env);

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});
