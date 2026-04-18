const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createHoodlefinanceAppScriptBindings,
  installHoodlefinanceAppScriptBindings,
} = require("../dist/ts/appscript/index.js");

const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";

const DEFAULT_CURRENCY_CODES_PAYLOAD = JSON.stringify({
  aliases: {},
  canonicalCodes: ["EUR", "USD"],
  cryptoCodes: [],
});
function createStoredTextResourcePayload(text, fetchedAtMs = Date.now()) {
  return JSON.stringify({
    fetchedAtMs,
    text,
  });
}

function createServices(fetchByUrl = {}) {
  const resolvedFetchByUrl = {
    [CURRENCY_CODES_URL]: DEFAULT_CURRENCY_CODES_PAYLOAD,
    ...fetchByUrl,
  };
  const cache = new Map();
  const fetchCalls = [];
  const properties = new Map();
  const scriptCache = {
    get(key) {
      return cache.has(key) ? cache.get(key) : null;
    },
    put(key, value) {
      cache.set(key, String(value));
    },
  };
  const urlFetchApp = {
    fetch(url) {
      fetchCalls.push(String(url));
      if (!Object.prototype.hasOwnProperty.call(resolvedFetchByUrl, url)) {
        throw new Error(`Unexpected fetch: ${url}`);
      }

      return {
        getContentText() {
          return resolvedFetchByUrl[url];
        },
        getResponseCode() {
          return 200;
        },
      };
    },
    fetchAll(requests) {
      return requests.map((request) =>
        this.fetch(typeof request === "string" ? request : request.url),
      );
    },
  };

  return {
    cacheService: {
      getScriptCache() {
        return scriptCache;
      },
    },
    cacheState: cache,
    fetchCalls,
    propertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return properties.has(key) ? properties.get(key) : null;
          },
          setProperty(key, value) {
            properties.set(key, String(value));
          },
        };
      },
    },
    propertiesState: properties,
    urlFetchApp,
  };
}

test("HOODLEFINANCE resolves local FX requests through the App Script bindings", () => {
  const services = createServices({
    [CURRENCY_CODES_URL]: DEFAULT_CURRENCY_CODES_PAYLOAD,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("USDUSD", "price"), 1);
});

test("HOODLEFINANCE reuses stored currency code data when the cache is cold", () => {
  const services = createServices();
  services.propertiesState.set(
    "hoodlefinance.currencyCodes",
    createStoredTextResourcePayload(DEFAULT_CURRENCY_CODES_PAYLOAD),
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("USDUSD", "price"), 1);
});

test("HOODLEFINANCE stores downloaded currency code data in script properties after FX lookups", () => {
  const services = createServices({
    [CURRENCY_CODES_URL]: DEFAULT_CURRENCY_CODES_PAYLOAD,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("USDUSD", "price"), 1);

  const storedPayload = JSON.parse(
    services.propertiesState.get("hoodlefinance.currencyCodes"),
  );

  assert.equal(storedPayload.text, DEFAULT_CURRENCY_CODES_PAYLOAD);
  assert.equal(typeof storedPayload.fetchedAtMs, "number");
});

test("HOODLEFINANCE falls back to stored currency code data when the refresh payload is malformed", () => {
  const services = createServices({
    [CURRENCY_CODES_URL]: "{not valid json",
  });
  const storedFetchedAtMs = Date.now() - 2 * 24 * 60 * 60 * 1000;
  services.propertiesState.set(
    "hoodlefinance.currencyCodes",
    createStoredTextResourcePayload(
      DEFAULT_CURRENCY_CODES_PAYLOAD,
      storedFetchedAtMs,
    ),
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("USDUSD", "price"), 1);
  assert.equal(
    services.cacheState.get("hoodlefinance:currencyCodes"),
    DEFAULT_CURRENCY_CODES_PAYLOAD,
  );
  assert.equal(
    services.propertiesState.get("hoodlefinance.currencyCodes"),
    createStoredTextResourcePayload(
      DEFAULT_CURRENCY_CODES_PAYLOAD,
      storedFetchedAtMs,
    ),
  );
});

const LON_SEARCH_SJPA_HTML = `
<tbody>
  <tr class="medium-font-weight slide-panel">
    <td>SJPA</td>
    <td class="clickable td-with-link"><a class="dash-link blue-text bold-font-weight" href="javascript: UpdateOpener('ISHARES III PLC ISHRS CORE MSCI JAPAN IMI ETF USD (ACC)', '						IE00B4L5YX21|ZZ|GBX|EUE2|B4L61L2|SJPA
');" title="Select">ISHARES III PLC ISHRS CORE MSCI JAPAN IMI ETF USD (ACC)</a></td>
  </tr>
</tbody>
`;

const LON_SEARCH_EMPTY_HTML = `
<tbody>
  <tr class="medium-font-weight slide-panel">
    <td>OTHER</td>
    <td class="clickable td-with-link"><a class="dash-link blue-text bold-font-weight" href="javascript: UpdateOpener('Other Listing', 'IE0000000000|ZZ|GBX|EUE2|B4L61L2|OTHER
');" title="Select">Other Listing</a></td>
  </tr>
</tbody>
`;

// LON:ticker,isin goes directly to LSE — no Yahoo call. Covers both:
//   - tickers Yahoo covers (performance: was 2 calls, now 1)
//   - tickers Yahoo doesn't cover (functional: no longer errors)
test("HOODLEFINANCE resolves LON:ticker,isin via LSE without a Yahoo quote", () => {
  const services = createServices({
    "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA":
      LON_SEARCH_SJPA_HTML,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("LON:SJPA", "isin"), "IE00B4L5YX21");
  // Verify Yahoo was never called — only LSE (plus the always-fetched currency codes).
  const yahooCall = services.fetchCalls.find((url) =>
    url.includes("finance.yahoo.com"),
  );
  assert.equal(yahooCall, undefined, "Yahoo should not be called for LON:ticker,isin");
  assert.ok(
    services.fetchCalls.some((url) => url.includes("londonstockexchange.com")),
    "LSE should be called for LON:ticker,isin",
  );
});

test("HOODLEFINANCE resolves ticker.L,isin via LSE using the .L suffix form", () => {
  // SJPA.L uses the Yahoo-suffix form. exchange is inferred as "LON" from the .L
  // suffix at parse time, so LON-ISIN still fires — Yahoo is never called.
  const services = createServices({
    "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA":
      LON_SEARCH_SJPA_HTML,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("SJPA.L", "isin"), "IE00B4L5YX21");
  const yahooCall = services.fetchCalls.find((url) =>
    url.includes("finance.yahoo.com"),
  );
  assert.equal(yahooCall, undefined, "Yahoo should not be called for ticker.L,isin");
});

test("HOODLEFINANCE does not fall through to quote providers when LON ISIN lookup fails", () => {
  const services = createServices({
    "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA":
      LON_SEARCH_EMPTY_HTML,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.throws(
    () => bindings.HOODLEFINANCE("LON:SJPA", "isin"),
    /No LON ISIN is available for "SJPA"\./,
  );

  const yahooCall = services.fetchCalls.find((url) =>
    url.includes("finance.yahoo.com"),
  );
  assert.equal(yahooCall, undefined, "Yahoo should not be called after an LSE failure");
});

test("HOODLEFINANCE uses the preferred REIT Yahoo fallback symbol", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.deepEqual(services.fetchCalls, [
    CURRENCY_CODES_URL,
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json",
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d",
  ]);
});

test("HOODLEFINANCE falls back to the original Yahoo symbol when the preferred REIT whitelist fetch fails", () => {
  const services = createServices({
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-I?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.11,
                symbol: "NLY-I",
              },
            },
          ],
        },
      }),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.11);
});

test("HOODLEFINANCE reuses the cached preferred REIT whitelist when it is already present", () => {
  const services = createServices({
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  services.cacheState.set(
    "hoodlefinance:ts:preferredReitWhitelist",
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.deepEqual(services.fetchCalls, [
    CURRENCY_CODES_URL,
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d",
  ]);
});

test("HOODLEFINANCE reuses the stored preferred REIT whitelist when the cache is cold", () => {
  const services = createServices({
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  services.propertiesState.set(
    "hoodlefinance.preferredReitWhitelist",
    JSON.stringify({
      fetchedAtMs: Date.now(),
      text: JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    }),
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.equal(
    services.cacheState.get("hoodlefinance:ts:preferredReitWhitelist"),
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
  assert.deepEqual(services.fetchCalls, [
    CURRENCY_CODES_URL,
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d",
  ]);
});

test("HOODLEFINANCE caches and stores the preferred REIT whitelist after downloading it", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.equal(
    services.cacheState.get("hoodlefinance:ts:preferredReitWhitelist"),
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );

  const storedPayload = JSON.parse(
    services.propertiesState.get("hoodlefinance.preferredReitWhitelist"),
  );

  assert.equal(
    storedPayload.text,
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
  assert.equal(typeof storedPayload.fetchedAtMs, "number");
});

test("HOODLEFINANCE ignores malformed cached preferred REIT whitelist data and refreshes it", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  services.cacheState.set(
    "hoodlefinance:ts:preferredReitWhitelist",
    "{not valid json",
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.equal(
    services.cacheState.get("hoodlefinance:ts:preferredReitWhitelist"),
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
});

test("HOODLEFINANCE ignores malformed stored preferred REIT whitelist data and refreshes it", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  services.propertiesState.set(
    "hoodlefinance.preferredReitWhitelist",
    JSON.stringify({
      fetchedAtMs: Date.now(),
      text: "{not valid json",
    }),
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);

  const storedPayload = JSON.parse(
    services.propertiesState.get("hoodlefinance.preferredReitWhitelist"),
  );

  assert.equal(
    storedPayload.text,
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
});

test("HOODLEFINANCE falls back to stored preferred REIT whitelist data when the downloaded payload is malformed", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      "{not valid json",
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  const storedPayloadText = JSON.stringify({
    fetchedAtMs: Date.now() - 7 * 60 * 60 * 1000,
    text: JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  });
  services.propertiesState.set(
    "hoodlefinance.preferredReitWhitelist",
    storedPayloadText,
  );
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "price"), 24.78);
  assert.equal(
    services.propertiesState.get("hoodlefinance.preferredReitWhitelist"),
    storedPayloadText,
  );
  assert.equal(
    services.cacheState.get("hoodlefinance:ts:preferredReitWhitelist"),
    JSON.stringify({
      preferredTickers: ["NLY I"],
    }),
  );
});

test("HOODLEFINANCE keeps the original Google-style symbol for preferred REITs", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: ["NLY I"],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NYSE",
                regularMarketPrice: 24.78,
                symbol: "NLY-PI",
              },
            },
          ],
        },
      }),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  // TODO: restore to "NLY-I" when canonical quote representation is added
  assert.equal(bindings.HOODLEFINANCE("NLY-I", "symbol:google"), "NYSE:NLY-PI");
  assert.equal(bindings.HOODLEFINANCE("NLY-I", "symbol:yahoo"), "NLY-PI");
});

test("HOODLEFINANCE keeps non-whitelisted Yahoo tickers on their original fetch symbol", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json":
      JSON.stringify({
        preferredTickers: [],
      }),
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d":
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                exchangeName: "NMS",
                regularMarketPrice: 306.93,
                symbol: "GOOG",
              },
            },
          ],
        },
      }),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE("GOOG", "price"), 306.93);
  assert.equal(bindings.HOODLEFINANCE("GOOG", "price"), 306.93);
  assert.deepEqual(services.fetchCalls, [
    CURRENCY_CODES_URL,
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json",
    "https://query1.finance.yahoo.com/v8/finance/chart/GOOG?interval=1d&range=1d",
  ]);
});

test("HOODLEFINANCE rejects range identifiers until the TS range surface exists", () => {
  const services = createServices();
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.throws(
    () => bindings.HOODLEFINANCE([["GOOG"]], "price"),
    /Range identifiers are not yet supported in HOODLEFINANCE\./,
  );
});

test("installHoodlefinanceAppScriptBindings publishes the formula functions onto a target scope", () => {
  const services = createServices({
    [CURRENCY_CODES_URL]: DEFAULT_CURRENCY_CODES_PAYLOAD,
  });
  const scope = {};

  installHoodlefinanceAppScriptBindings(scope, services);

  assert.equal(typeof scope.HOODLEFINANCE, "function");
  assert.equal(typeof scope.HOODLEFINANCE_TS_ENVELOPE, "undefined");
  assert.equal(typeof scope.hoodlefinanceBuildSheetsAddOnHomepage, "function");
  assert.equal(scope.HOODLEFINANCE("USDUSD", "price"), 1);
});
