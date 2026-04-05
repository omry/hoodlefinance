const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  FunctionValueResolver,
  LocalFxResolver,
  PseEdgeResolver,
  PseFramesResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
  TradingviewFundResolver,
  RequestInput,
  FxRequest,
  EquityRequest,
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

test("FunctionValueResolver executes resolved job callbacks and materializes from refs", () => {
  const resolver = FunctionValueResolver.fromSpec(
    "ATTRIBUTE-IDENTITY",
    {
      options: {
        routingDescription: "Direct lookup",
      },
      resolveFunctionRef: "ATTRIBUTE-IDENTITY",
      resolverClass: "FunctionValueResolver",
    },
    {
      resolveFunctionsByRef: {
        "ATTRIBUTE-IDENTITY"(job) {
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

  const stubResolver = FunctionValueResolver.fromSpec(
    "ATTRIBUTE-IDENTITY",
    {
      resolveFunctionRef: "MISSING",
      resolverClass: "FunctionValueResolver",
    },
    {
      resolveFunctionsByRef: {},
    },
  );
  const stubResults = stubResolver.executeBatch([{ routeState: {} }]);
  assert.equal(stubResults[0].status, "terminal_error");
  assert.match(
    String(stubResults[0].error instanceof Error ? stubResults[0].error.message : stubResults[0].error),
    /Resolver function ref "MISSING" is not available for "ATTRIBUTE-IDENTITY"\./,
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
  const resolver = new GoogleFxResolver({
    fetchText(url) {
      assert.equal(url, "https://www.google.com/finance/quote/EUR-USD");
      return html;
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      cachedWrite = { cacheKey, ttlSeconds, value };
      return value;
    },
  });
  const request = new FxRequest({
    attribute: "price",
    fxPair,
    identifier: "EURUSD",
    identifierResolutionMs: 0,
  });

  assert.equal(resolver.canHandle(request), true);
  assert.deepEqual(resolver.buildRouteState(request), { fxPair });

  const fetchedResults = resolver.executeBatch([
    { routeState: { fxPair } },
  ]);
  assert.equal(fetchedResults[0].status, "success");
  assert.equal(fetchedResults[0].quote.regularMarketPrice, 1.25);
  assert.equal(fetchedResults[0].quote.symbol, "EURUSD");
  assert.equal(fetchedResults[0].quote.shortName, "EURUSD");
  assert.equal(
    fetchedResults[0].quote.hoodlefinanceFxGoogleSymbol,
    "CURRENCY:EURUSD",
  );
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:google-finance:EUR-USD",
    ttlSeconds: 60,
    value: {
      currency: "USD",
      exchangeDataDelayedBy: 0,
      financialCurrency: "USD",
      previousClose: 1.24,
      regularMarketPreviousClose: 1.24,
      regularMarketPrice: 1.25,
      regularMarketTime: 1700000000,
      shortName: "Euro (EUR / USD)",
      symbol: "EURUSD",
    },
  });

  const cachedResolver = new GoogleFxResolver({
    fetchText() {
      throw new Error("cache hit should not fetch Google Finance");
    },
    getCachedJson() {
      return cachedWrite.value;
    },
    putCachedJson() {
      throw new Error("cache hit should not write Google Finance cache");
    },
  });

  const cachedResults = cachedResolver.executeBatch([
    { routeState: { fxPair } },
  ]);
  assert.equal(cachedResults[0].status, "success");
  assert.equal(cachedResults[0].quote.regularMarketPrice, 1.25);
  assert.equal(cachedResults[0].quote.shortName, "EURUSD");
  assert.equal(
    cachedResults[0].quote.hoodlefinanceFxGoogleSymbol,
    "CURRENCY:EURUSD",
  );
});

test("PseFramesResolver resolves cached and fetched PSE frame quotes", () => {
  const frameHtml = createPseFrameHtml();
  let cachedWrite = null;
  const resolver = new PseFramesResolver({
    fetchAllInChunks(_source, requests) {
      return requests.map((request) => ({
        request,
        response: {
          getContentText() {
            return frameHtml;
          },
          getResponseCode() {
            return 200;
          },
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
  });
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
  assert.equal(fetchedResult.value.symbol, "BDO");
  assert.equal(fetchedResult.value.shortName, "BDO Unibank, Inc.");
  assert.deepEqual(cachedWrite, {
    cacheKey: "hoodlefinance:pse:BDO",
    ttlSeconds: 300,
    value: {
      currency: "PHP",
      exchangeDataDelayedBy: 0,
      financialCurrency: "PHP",
      isin: "PHY077751022",
      longName: "BDO Unibank, Inc.",
      regularMarketChange: 9.87 - 9.75,
      regularMarketChangePercent: (9.87 - 9.75) / 9.75,
      regularMarketDayHigh: 10.1,
      regularMarketDayLow: 9.6,
      regularMarketOpen: 9.8,
      regularMarketPreviousClose: 9.75,
      regularMarketPrice: 9.87,
      regularMarketTime: Math.floor(
        Date.parse("Jan 2, 2024 3:00 PM GMT+0800") / 1000,
      ),
      regularMarketVolume: 12345,
      shortName: "BDO Unibank, Inc.",
      symbol: "BDO",
    },
  });

  const cachedResolver = new PseFramesResolver({
    fetchAllInChunks() {
      throw new Error("cache hit should not fetch PSE frames");
    },
    getCachedJson() {
      return cachedWrite.value;
    },
    putCachedJson() {
      throw new Error("cache hit should not write PSE frames cache");
    },
  });

  const cachedResult = cachedResolver.resolve(request);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.symbol, "BDO");
  assert.equal(cachedResult.value.regularMarketPrice, 9.87);
});

test("PseEdgeResolver resolves cached and fetched PSE edge quotes", () => {
  const stockHtml = createPseStockHtml();
  let listingCacheWrite = null;
  let quoteCacheWrite = null;
  const resolver = new PseEdgeResolver({
    fetchAllInChunks(_source, requests) {
      if (requests.length && requests[0].url.indexOf("companyDirectory/search.ax") >= 0) {
        return requests.map((request) => ({
          request,
          response: {
            getContentText() {
              return createPseSearchHtml();
            },
            getResponseCode() {
              return 200;
            },
          },
        }));
      }

      return requests.map((request) => ({
        request,
        response: {
          getContentText() {
            return stockHtml;
          },
          getResponseCode() {
            return 200;
          },
        },
      }));
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
  });
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
  assert.equal(fetchedResult.value.symbol, "BDO");
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
      financialCurrency: "PHP",
      isin: "PHY077751022",
      longName: "BDO Unibank, Inc.",
      regularMarketChange: 0.12,
      regularMarketChangePercent: 0.0123,
      regularMarketDayHigh: 10.1,
      regularMarketDayLow: 9.6,
      regularMarketOpen: 9.8,
      regularMarketPreviousClose: 9.75,
      regularMarketPrice: 9.87,
      regularMarketTime: Math.floor(
        Date.parse("Jan 2, 2024 3:00 PM GMT+0800") / 1000,
      ),
      regularMarketVolume: 12345,
      shortName: "BDO Unibank, Inc.",
      symbol: "BDO",
    },
  });
});

test("YahooQuoteResolver resolves cached and fetched Yahoo quote lookups", () => {
  const cachedResolver = new YahooQuoteResolver({
    fetchAllInChunks(_source, requests) {
      assert.deepEqual(requests, []);
      return [];
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
  });
  const cachedRequest = new EquityRequest({
    attribute: "price",
    identifier: "GOOG",
    yahooSymbol: "GOOG",
  });

  assert.equal(cachedResolver.canHandle(cachedRequest), true);
  assert.deepEqual(cachedResolver.buildRouteState(cachedRequest), {
    fxPair: null,
    yahooSymbol: "GOOG",
  });

  const cachedResult = cachedResolver.resolve(cachedRequest);
  assert.equal(cachedResult.status, "success");
  assert.equal(cachedResult.value.regularMarketPrice, 123.45);

  let cachedWrite = null;
  const fetchedResolver = new YahooQuoteResolver({
    fetchAllInChunks(_source, requests) {
      return requests.map((request) => ({
        request,
        response: {
          getContentText() {
            return JSON.stringify({
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
            });
          },
          getResponseCode() {
            return 200;
          },
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
  });

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
  const cachedResolver = new TradingviewFundResolver({
    fetchAllInChunks(_source, requests) {
      assert.deepEqual(requests, []);
      return [];
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
  });
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
  const fetchedResolver = new TradingviewFundResolver({
    fetchAllInChunks(_source, requests) {
      return requests.map((request) => ({
        request,
        response: {
          getContentText() {
            return html;
          },
          getResponseCode() {
            return 200;
          },
        },
      }));
    },
    getCachedJson() {
      return null;
    },
    putCachedJson(cacheKey, value, ttlSeconds) {
      fetchedWrites.push({ cacheKey, ttlSeconds, value });
      return value;
    },
  });

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
