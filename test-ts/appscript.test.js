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

// TODO: FlowEngine has no direct-ISIN node for LON:/PSE: tickers with `isin`
// attribute. The legacy path used resolveDirectIsinAttributeValue to short-
// circuit to an exchange fetch without a Yahoo quote. Tracked as followup in
// docs/design/routing/graph-driven-execution.md.
test.todo("HOODLEFINANCE supports direct ISIN attribute lookups that only need fetchText");

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

  assert.equal(bindings.HOODLEFINANCE("NLY-I", "symbol:google"), "NLY-I");
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
