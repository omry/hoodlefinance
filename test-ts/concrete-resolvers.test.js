const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooEquityQuoteResolver,
  YahooFxResolver,
  TradingviewFundResolver,
  RequestInput,
  FxRequest,
  EquityRequest,
} = require("../dist/ts/core/index.js");
const { createTextHttpResponse } = require("./resource-fixtures.js");
const { createTestResolverServices } = require("./resolver-service-fixtures.js");

function textResponse(text) {
  return createTextHttpResponse(text);
}

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

function initResolver(resolver, services) {
  resolver.initEnv(services);
  return resolver;
}

function createPseFrameHtml() {
  return `
    <html>
      <input
        id="stock-json"
        value="${JSON.stringify({
          full_name: "BDO Unibank, Inc.",
          name: "BDO",
        }).replace(/"/g, "&quot;")}"
      />
      <input id="symbol-json" value="BDO" />
      <h3>BDO</h3>
      <div>BDO Unibank, Inc.</div>
      <div>
        <a href="companyDisclosures/form.do?cmpy_id=1234">company</a>
      </div>
      <table>
        <tr><td>ISIN</td><td>PHY077751022</td></tr>
        <tr><td>Prev Close</td><td>9.75</td></tr>
        <tr><td>High</td><td>10.10</td></tr>
        <tr><td>Low</td><td>9.60</td></tr>
        <tr><td>Open</td><td>9.80</td></tr>
        <tr><td>Volume</td><td>12345</td></tr>
      </table>
      <h3 class="last-price">9.87</h3>
      As of Jan 2, 2024 3:00 PM
    </html>
  `;
}

function createPseSearchHtml() {
  return `
    <html>
      <table>
        <tr>
          <td>
            <a href="#" onclick="cmDetail('1234','5678');return false;">BDO Unibank, Inc.</a>
          </td>
          <td class="alignC"><a href="#">BDO</a></td>
        </tr>
      </table>
    </html>
  `;
}

function createPseStockHtml() {
  return `
    <html>
      <div class="compInfo"><p>BDO Unibank, Inc.</p></div>
      <select>
        <option value="BDO" selected>BDO</option>
      </select>
      <table>
        <tr><th>Previous Close and Date</th><td>9.75</td></tr>
        <tr><th>Last Traded Price</th><td>9.87</td></tr>
        <tr><th>Change(% Change)</th><td>up 0.12 (1.23%)</td></tr>
        <tr><th>ISIN</th><td>PHY077751022</td></tr>
        <tr><th>High</th><td>10.10</td></tr>
        <tr><th>Low</th><td>9.60</td></tr>
        <tr><th>Open</th><td>9.80</td></tr>
        <tr><th>Volume</th><td>12345</td></tr>
      </table>
      As of Jan 2, 2024 3:00 PM
    </html>
  `;
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

  const results = resolver.executeBatch([
    { routeState: { fxPair: request.fxPair } },
  ]);
  assert.equal(results[0].status, "success");
  assert.equal(results[0].quote.regularMarketPrice, 1);
  assert.equal(results[0].quote.symbol, "USDUSD");
});

test("GoogleFxResolver resolves cached and fetched Google Finance FX quotes", () => {
  const fxPair = {
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
  };
  const html = `AF_initDataCallback({data:${JSON.stringify([
    [
      fxPair.googlePairSlug,
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
  let cachedWrite = null;
  const resolver = initResolver(new GoogleFxResolver(), createTestResolverServices({
    httpFetch(url) {
      assert.equal(url, "https://www.google.com/finance/quote/EUR-USD");
      return textResponse(html);
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  }));
  const request = new FxRequest({
    attribute: "price",
    fxPair,
    identifier: "EURUSD",
    identifierResolutionMs: 0,
  });

  assert.equal(resolver.canHandle(request), true);
  assert.deepEqual(resolver.buildRouteState(request), { fxPair });

  const fetchedResults = resolver.executeBatch([{ routeState: { fxPair } }]);
  assert.equal(fetchedResults[0].status, "success");
  assert.equal(fetchedResults[0].quote.regularMarketPrice, 1.25);
  assert.equal(fetchedResults[0].quote.symbol, "EURUSD");
  assert.equal(fetchedResults[0].quote.shortName, "EURUSD");
  assert.equal(fetchedResults[0].quote.googleSymbol, "CURRENCY:EURUSD");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:google-finance:EUR-USD",
    ttlSeconds: 60,
    value: {
      currency: "USD",
      exchangeDataDelayedBy: 0,
      financialCurrency: "USD",
      regularMarketPreviousClose: 1.24,
      regularMarketPrice: 1.25,
      regularMarketTime: 1700000000,
      shortName: "Euro (EUR / USD)",
      symbol: "EURUSD",
    },
  });

  const cachedResolver = initResolver(new GoogleFxResolver(), createTestResolverServices({
    httpFetch() {
      throw new Error("cache hit should not fetch Google Finance");
    },
    getCachedJson() {
      return cachedWrite.value;
    },
    putCachedJson() {
      throw new Error("cache hit should not write Google Finance cache");
    },
  }));

  const cachedResults = cachedResolver.executeBatch([
    { routeState: { fxPair } },
  ]);
  assert.equal(cachedResults[0].status, "success");
  assert.equal(cachedResults[0].quote.regularMarketPrice, 1.25);
  assert.equal(cachedResults[0].quote.shortName, "EURUSD");
  assert.equal(cachedResults[0].quote.googleSymbol, "CURRENCY:EURUSD");
});

test("PseFramesResolver resolves cached and fetched PSE frame quotes", () => {
  const frameHtml = createPseFrameHtml();
  let cachedWrite = null;
  const resolver = initResolver(new PseFramesResolver(), createTestResolverServices({
    httpFetch() {
      return textResponse(frameHtml);
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  }));
  const request = new EquityRequest({
    allowTradingviewFallback: false,
    attribute: "price",
    exchange: "PSE",
    identifier: "PSE:BDO",
    identifierResolutionMs: 0,
    symbol: "BDO",
    yahooSymbol: "BDO.PS",
  });

  assert.equal(resolver.canHandle(request), true);
  assert.deepEqual(resolver.buildRouteState(request), { symbol: "BDO" });
  assert.equal(resolver.describe(request), "EQUITY -> PSE -> PSE-FRAMES");

  const fetchedResult = resolver.resolve(request);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.regularMarketPrice, 9.87);
  assert.equal(fetchedResult.value.symbol, "BDO.PS");
  assert.equal(fetchedResult.value.shortName, "BDO Unibank, Inc.");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:pse:BDO",
    ttlSeconds: 300,
    value: {
      currency: "PHP",
      exchangeDataDelayedBy: 0,
      exchangeName: "PSE",
      financialCurrency: "PHP",
      isin: "PHY077751022",
      longName: "BDO Unibank, Inc.",
      regularMarketDayHigh: 10.1,
      regularMarketDayLow: 9.6,
      regularMarketPreviousClose: 9.75,
      regularMarketPrice: 9.87,
      regularMarketTime: Math.floor(
        Date.parse("Jan 2, 2024 3:00 PM GMT+0800") / 1000,
      ),
      regularMarketVolume: 12345,
      shortName: "BDO Unibank, Inc.",
      symbol: "BDO.PS",
    },
  });

  const cachedResolver = initResolver(new PseFramesResolver(), createTestResolverServices({
    httpFetch() {
      throw new Error("cache hit should not fetch PSE frames");
    },
    getCachedJson() {
      return cachedWrite.value;
    },
    putCachedJson() {
      throw new Error("cache hit should not write PSE frames cache");
    },
  }));

  const cachedResult = cachedResolver.resolve(request);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.symbol, "BDO.PS");
  assert.equal(cachedResult.value.regularMarketPrice, 9.87);
});

test("PseEdgeResolver resolves cached and fetched PSE edge quotes", () => {
  const stockHtml = createPseStockHtml();
  let listingCacheWrite = null;
  let quoteCacheWrite = null;
  const resolver = initResolver(new PseEdgeResolver(), createTestResolverServices({
    httpFetch(url) {
      if (String(url).indexOf("companyDirectory/search.ax") >= 0) {
        return textResponse(createPseSearchHtml());
      }

      return textResponse(stockHtml);
    },
    getCachedJson(cacheKey) {
      return cacheKey === "hoodlefinance:pse:listing:BDO" ? null : null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      if (String(cacheKey).includes(":listing:")) {
        listingCacheWrite = { cacheKey, ttlSeconds, value };
      } else {
        quoteCacheWrite = { cacheKey, ttlSeconds, value };
      }

      return value;
    },
  }));
  const request = new EquityRequest({
    allowTradingviewFallback: false,
    attribute: "price",
    exchange: "PSE",
    identifier: "PSE:BDO",
    identifierResolutionMs: 0,
    symbol: "BDO",
    yahooSymbol: "BDO.PS",
  });

  assert.equal(resolver.canHandle(request), true);
  assert.deepEqual(resolver.buildRouteState(request), { symbol: "BDO" });
  assert.equal(resolver.describe(request), "EQUITY -> PSE -> PSE-EDGE");

  const fetchedResult = resolver.resolve(request);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.regularMarketPrice, 9.87);
  assert.equal(fetchedResult.value.symbol, "BDO.PS");
  assert.equal(fetchedResult.value.shortName, "BDO Unibank, Inc.");
  assert.deepEqual(listingCacheWrite, {
    cacheKey: "hoodlefinance:pse:listing:BDO",
    ttlSeconds: 21600,
    value: {
      companyId: "1234",
      name: "BDO Unibank, Inc.",
      securityId: "5678",
      symbol: "BDO",
    },
  });
  assert.deepEqual(quoteCacheWrite, {
    cacheKey: "hoodlefinance:pse:BDO",
    ttlSeconds: 300,
    value: {
      currency: "PHP",
      exchangeDataDelayedBy: 0,
      exchangeName: "PSE",
      financialCurrency: "PHP",
      isin: "PHY077751022",
      longName: "BDO Unibank, Inc.",
      regularMarketDayHigh: 10.1,
      regularMarketDayLow: 9.6,
      regularMarketPreviousClose: 9.75,
      regularMarketPrice: 9.87,
      regularMarketTime: Math.floor(
        Date.parse("Jan 2, 2024 3:00 PM GMT+0800") / 1000,
      ),
      regularMarketVolume: 12345,
      shortName: "BDO Unibank, Inc.",
      symbol: "BDO.PS",
    },
  });
});

test("YahooEquityQuoteResolver resolves cached and fetched Yahoo quote lookups", () => {
  const cachedResolver = initResolver(new YahooEquityQuoteResolver(), createTestResolverServices({
    httpFetch() {
      throw new Error("cache hit should not fetch Yahoo quote");
    },
    getCachedJson(cacheKey) {
      return cacheKey === "hoodlefinance:GOOG"
        ? {
            regularMarketPrice: 123.45,
            symbol: "GOOG",
          }
        : null;
    },
    putCachedJson(_cacheKey, value) {
      return value;
    },
  }));
  const cachedRequest = new EquityRequest({
    attribute: "price",
    identifier: "GOOG",
    yahooSymbol: "GOOG",
  });

  assert.equal(cachedResolver.canHandle(cachedRequest), true);
  assert.deepEqual(cachedResolver.buildRouteState(cachedRequest), {
    fxPair: null,
    preferredYahooSymbol: "",
    yahooSymbol: "GOOG",
  });

  const cachedResult = cachedResolver.resolve(cachedRequest);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.regularMarketPrice, 123.45);

  let cachedWrite = null;
  const fetchedResolver = initResolver(new YahooEquityQuoteResolver(), createTestResolverServices({
    httpFetch() {
      return textResponse(JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 99.5,
                symbol: "GOOG",
              },
            },
          ],
        },
      }));
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  }));

  const fetchedResult = fetchedResolver.resolve(cachedRequest);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.regularMarketPrice, 99.5);
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:GOOG",
    ttlSeconds: 60,
    value: {
      regularMarketPrice: 99.5,
      symbol: "GOOG",
    },
  });
});

test("YahooEquityQuoteResolver owns preferred equity fallback symbols without affecting FX route state", () => {
  let lastFetchedUrl = null;
  let cachedWrite = null;
  const resolver = new YahooEquityQuoteResolver();
  resolver.initEnv(createTestResolverServices({
    httpFetch(url) {
      lastFetchedUrl = url;
      return textResponse(JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }));
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
    getCachedString(cacheKey) {
      assert.equal(cacheKey, "hoodlefinance:ts:preferredReitWhitelist");
      return JSON.stringify({
        preferredTickers: ["NLY I"],
      });
    },
    putCachedString() {
      throw new Error("valid cached whitelist should not be rewritten");
    },
  }));

  const equityRequest = new EquityRequest({
    attribute: "price",
    identifier: "NLY-I",
    yahooSymbol: "NLY-I",
  });
  const fxPair = {
    baseCanonicalCode: "EUR",
    canonicalPair: "EURUSD",
    quoteCanonicalCode: "USD",
    yahooChartSymbol: "EURUSD=X",
  };
  const fxRequest = new FxRequest({
    attribute: "price",
    fxPair,
    identifier: "EURUSD",
  });

  assert.deepEqual(resolver.buildRouteState(equityRequest), {
    fxPair: null,
    preferredYahooSymbol: "NLY-PI",
    yahooSymbol: "NLY-I",
  });
  assert.deepEqual(resolver.buildRouteState(fxRequest), {
    fxPair,
    yahooSymbol: "EURUSD=X",
  });

  const result = resolver.resolve(equityRequest);
  assert.equal(result.status, "success");
  assert.equal(
    lastFetchedUrl,
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d",
  );
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:NLY-PI",
    ttlSeconds: 60,
    value: {
      regularMarketPrice: 24.78,
      symbol: "NLY-PI",
    },
  });
});

test("YahooEquityQuoteResolver falls back to stored preferred whitelist data when refresh fails", () => {
  let cachedWhitelistWrite = null;
  let storedWhitelistWrite = null;
  const resolver = new YahooEquityQuoteResolver();
  resolver.initEnv(createTestResolverServices({
    httpFetch(url) {
      if (
        url ===
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json"
      ) {
        throw new Error("whitelist refresh failed");
      }

      return textResponse(JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }));
    },
    getCachedJson() {
      return null;
    },
    getCachedString(cacheKey) {
      assert.equal(cacheKey, "hoodlefinance:ts:preferredReitWhitelist");
      return "";
    },
    getStoredTextResource(resourceKey) {
      assert.equal(resourceKey, "hoodlefinance.preferredReitWhitelist");
      return {
        fetchedAtMs: Date.now() - 7 * 60 * 60 * 1000,
        text: JSON.stringify({
          preferredTickers: ["NLY I"],
        }),
      };
    },
    putCachedString(cacheKey, value, ttlSeconds) {
      cachedWhitelistWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
    putStoredTextResource(resourceKey, text, fetchedAtMs) {
      storedWhitelistWrite = { fetchedAtMs, resourceKey, text };
      return { fetchedAtMs, text };
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      return { cacheKey, ttlSeconds, value };
    },
  }));

  const routeState = resolver.buildRouteState(
    new EquityRequest({
      attribute: "price",
      identifier: "NLY-I",
      yahooSymbol: "NLY-I",
    }),
  );

  assert.deepEqual(routeState, {
    fxPair: null,
    preferredYahooSymbol: "NLY-PI",
    yahooSymbol: "NLY-I",
  });
  assert.deepEqual(cachedWhitelistWrite, {
    cacheKey: "hoodlefinance:ts:preferredReitWhitelist",
    ttlSeconds: 21600,
    value: JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  });
  assert.equal(storedWhitelistWrite, null);
});

test("TradingviewFundResolver resolves cached and fetched TradingView fund quotes", () => {
  const html = `
    <html>
      <script>
        window.initData.symbolInfo = {
          "resolved_symbol":"TASE:KSMF59",
          "currency":"ILS",
          "description":"KSM KSMF59",
          "short_name":"KSMF59",
          "isin_displayed":"IL0000000001"
        };
      </script>
      trades at 17.25 ILS today
    </html>
  `;

  const cachedWrites = [];
  const cachedResolver = initResolver(new TradingviewFundResolver(), createTestResolverServices({
    httpFetch() {
      throw new Error("cache hit should not fetch TradingView");
    },
    getCachedJson(cacheKey) {
      return cacheKey === "hoodlefinance:tradingview:quote:KSMF59.TA"
        ? {
            currency: "ILS",
            exchangeName: "TASE",
            financialCurrency: "ILS",
            longName: "KSM KSMF59",
            regularMarketPrice: 17.25,
            shortName: "KSMF59",
            symbol: "KSMF59.TA",
          }
        : null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrites.push({ cacheKey, ttlSeconds, value });
      return value;
    },
  }));
  const cachedRequest = new EquityRequest({
    attribute: "price",
    allowTradingviewFallback: true,
    exchange: "TLV",
    identifier: "TLV:KSMF59",
    identifierResolutionMs: 0,
    symbol: "KSM.F59",
    yahooSymbol: "KSMF59.TA",
  });

  assert.equal(cachedResolver.canHandle(cachedRequest), true);
  assert.deepEqual(cachedResolver.buildRouteState(cachedRequest), {
    yahooSymbol: "KSMF59.TA",
  });

  const cachedResult = cachedResolver.resolve(cachedRequest);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.regularMarketPrice, 17.25);
  assert.equal(cachedResult.value.symbol, "KSMF59.TA");
  assert.deepEqual(cachedWrites, [
    {
      cacheKey: "hoodlefinance:KSMF59.TA",
      ttlSeconds: 60,
      value: {
        currency: "ILS",
        exchangeName: "TASE",
        financialCurrency: "ILS",
        longName: "KSM KSMF59",
        regularMarketPrice: 17.25,
        shortName: "KSMF59",
        symbol: "KSMF59.TA",
      },
    },
  ]);

  const fetchedWrites = [];
  const fetchedResolver = initResolver(new TradingviewFundResolver(), createTestResolverServices({
    httpFetch() {
      return textResponse(html);
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      fetchedWrites.push({ cacheKey, ttlSeconds, value });
      return value;
    },
  }));

  const fetchedResult = fetchedResolver.resolve(cachedRequest);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.regularMarketPrice, 17.25);
  assert.equal(fetchedResult.value.longName, "KSM KSMF59");
  assert.deepEqual(fetchedWrites, [
    {
      cacheKey: "hoodlefinance:tradingview:quote:KSMF59.TA",
      ttlSeconds: 60,
      value: {
        currency: "ILS",
        exchangeName: "TASE",
        financialCurrency: "ILS",
        isin: "IL0000000001",
        longName: "KSM KSMF59",
        regularMarketPrice: 17.25,
        shortName: "KSMF59",
        symbol: "KSMF59.TA",
      },
    },
    {
      cacheKey: "hoodlefinance:KSMF59.TA",
      ttlSeconds: 60,
      value: {
        currency: "ILS",
        exchangeName: "TASE",
        financialCurrency: "ILS",
        isin: "IL0000000001",
        longName: "KSM KSMF59",
        regularMarketPrice: 17.25,
        shortName: "KSMF59",
        symbol: "KSMF59.TA",
      },
    },
  ]);
});

test("PseIsinMapResolver resolves Philippine ISIN inputs through the map lookup", () => {
  let fetchCount = 0;
  let cachedWrite = null;
  let storedWrite = null;
  const resolver = new PseIsinMapResolver();
  resolver.initEnv(createTestResolverServices({
    httpFetch(url) {
      fetchCount += 1;
      assert.equal(
        url,
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties",
      );
      return textResponse("PHY077751022=PSE:BDO\n");
    },
    getCachedString() {
      return "";
    },
    putCachedString(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
    putStoredTextResource(resourceKey, text, fetchedAtMs) {
      storedWrite = { fetchedAtMs, resourceKey, text };
      return { fetchedAtMs, text };
    },
  }));
  const requestInput = createRequestInput({
    attribute: "price",
    attributeType: "quote",
    classification: "isin",
    identifier: "ISIN:PHY077751022",
    ticker: "ISIN:PHY077751022",
  });

  assert.equal(resolver.canHandle(requestInput), true);

  const success = resolver.resolve(requestInput);
  assert.equal(success.status, "success");
  assert.equal(success.value.exchange, "PSE");
  assert.equal(success.value.symbol, "BDO");
  assert.equal(fetchCount, 1);
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:ts:pseIsinMap",
    ttlSeconds: 21600,
    value: "PHY077751022=PSE:BDO\n",
  });
  assert.equal(storedWrite?.resourceKey, "hoodlefinance.pseIsinMap");
  assert.equal(storedWrite?.text, "PHY077751022=PSE:BDO\n");
  assert.equal(typeof storedWrite?.fetchedAtMs, "number");

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
  assert.equal(fetchCount, 1);
});

test("PseIsinMapResolver falls back to stored map data when refresh fails", () => {
  let cachedWrite = null;
  let storedWrite = null;
  const resolver = new PseIsinMapResolver();
  resolver.initEnv(createTestResolverServices({
    httpFetch(url) {
      assert.equal(
        url,
        "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties",
      );
      throw new Error("map refresh failed");
    },
    getCachedString(cacheKey) {
      assert.equal(cacheKey, "hoodlefinance:ts:pseIsinMap");
      return "";
    },
    getStoredTextResource(resourceKey) {
      assert.equal(resourceKey, "hoodlefinance.pseIsinMap");
      return {
        fetchedAtMs: Date.now() - 7 * 60 * 60 * 1000,
        text: "PHY077751022=PSE:BDO\n",
      };
    },
    putCachedString(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
    putStoredTextResource(resourceKey, text, fetchedAtMs) {
      storedWrite = { fetchedAtMs, resourceKey, text };
      return { fetchedAtMs, text };
    },
  }));

  const result = resolver.resolve(
    createRequestInput({
      attribute: "price",
      attributeType: "quote",
      classification: "isin",
      identifier: "ISIN:PHY077751022",
      ticker: "ISIN:PHY077751022",
    }),
  );

  assert.equal(result.status, "success");
  assert.equal(result.value.exchange, "PSE");
  assert.equal(result.value.symbol, "BDO");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:ts:pseIsinMap",
    ttlSeconds: 21600,
    value: "PHY077751022=PSE:BDO\n",
  });
  assert.equal(storedWrite, null);
});

test("YahooIsinSearchResolver resolves cached and fetched Yahoo ISIN lookups", () => {
  const cachedResolver = initResolver(new YahooIsinSearchResolver(), createTestResolverServices({
    httpFetch() {
      throw new Error("cache hit should not fetch Yahoo ISIN search");
    },
    getCachedString(cacheKey) {
      return cacheKey === "hoodlefinance:isin:US02079K1079" ? "GOOG" : "";
    },
    putCachedString(value) {
      return value;
    },
  }));
  const cachedRequest = createRequestInput({
    attribute: "price",
    attributeType: "quote",
    classification: "isin",
    identifier: "ISIN:US02079K1079",
    ticker: "ISIN:US02079K1079",
  });

  assert.equal(cachedResolver.canHandle(cachedRequest), true);

  const cachedResult = cachedResolver.resolve(cachedRequest);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.yahooSymbol, "GOOG");

  let cachedWrite = null;
  const fetchedResolver = initResolver(new YahooIsinSearchResolver(), createTestResolverServices({
    httpFetch() {
      return textResponse(JSON.stringify({
        quotes: [
          {
            exchange: "NYSE",
            quoteType: "EQUITY",
            score: 10,
            symbol: "IBM",
          },
        ],
      }));
    },
    getCachedString() {
      return "";
    },
    putCachedString(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  }));

  const fetchedResult = fetchedResolver.resolve(cachedRequest);
  assert.equal(fetchedResult.status, "success");
  assert.equal(fetchedResult.value.yahooSymbol, "IBM");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:isin:US02079K1079",
    ttlSeconds: 21600,
    value: "IBM",
  });
});
