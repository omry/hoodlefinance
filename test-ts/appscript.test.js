const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createHoodlefinanceAppScriptBindings,
  installHoodlefinanceAppScriptBindings,
} = require("../dist/ts/appscript/index.js");

function createServices(fetchByUrl = {}) {
  const cache = new Map();
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
      if (!Object.prototype.hasOwnProperty.call(fetchByUrl, url)) {
        throw new Error(`Unexpected fetch: ${url}`);
      }

      return {
        getContentText() {
          return fetchByUrl[url];
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
    urlFetchApp,
  };
}

test("HOODLEFINANCE_TS resolves local FX requests through the App Script bindings", () => {
  const services = createServices();
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE_TS("USDUSD", "price"), 1);

  const envelope = JSON.parse(
    bindings.HOODLEFINANCE_TS_ENVELOPE("USDUSD", "price"),
  );
  assert.equal(envelope.status, "success");
  assert.equal(envelope.value.regularMarketPrice, 1);
  assert.equal(envelope.value.hoodlefinanceFxDisplayCurrency, "USD");
});

test("HOODLEFINANCE_TS supports direct ISIN attribute lookups that only need fetchText", () => {
  const services = createServices({
    "https://www.londonstockexchange.com/exchange/instrument-result.html?codeName=SJPA": `
      <html>
        <table>
          <tr>
            <td>SJPA</td>
            <td>
              <span>UpdateOpener('1','US0000000001|GB|GBP|LSE|123|SJPA')</span>
              <a href="/instrument/SJPA">SJPA Holdings</a>
            </td>
          </tr>
        </table>
      </html>
    `,
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE_TS("LON:SJPA", "isin"), "US0000000001");
});

test("HOODLEFINANCE_TS uses the preferred REIT Yahoo fallback symbol", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json": JSON.stringify(
      {
        preferredTickers: ["NLY I"],
      },
    ),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d": JSON.stringify(
      {
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
      },
    ),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE_TS("NLY-I", "price"), 24.78);
});

test("HOODLEFINANCE_TS falls back to the original Yahoo symbol when the preferred REIT whitelist fetch fails", () => {
  const services = createServices({
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-I?interval=1d&range=1d": JSON.stringify(
      {
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
      },
    ),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE_TS("NLY-I", "price"), 24.11);
});

test("HOODLEFINANCE_TS keeps the original Google-style symbol for preferred REITs", () => {
  const services = createServices({
    "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/preferred-reit-whitelist.json": JSON.stringify(
      {
        preferredTickers: ["NLY I"],
      },
    ),
    "https://query1.finance.yahoo.com/v8/finance/chart/NLY-PI?interval=1d&range=1d": JSON.stringify(
      {
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
      },
    ),
  });
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.equal(bindings.HOODLEFINANCE_TS("NLY-I", "symbol:google"), "NLY-I");
  assert.equal(bindings.HOODLEFINANCE_TS("NLY-I", "symbol:yahoo"), "NLY-PI");
});

test("HOODLEFINANCE_TS rejects range identifiers until the TS range surface exists", () => {
  const services = createServices();
  const bindings = createHoodlefinanceAppScriptBindings(services);

  assert.throws(
    () => bindings.HOODLEFINANCE_TS([["GOOG"]], "price"),
    /Range identifiers are not yet supported in HOODLEFINANCE_TS\./,
  );
});

test("installHoodlefinanceAppScriptBindings publishes the formula functions onto a target scope", () => {
  const services = createServices();
  const scope = {};

  installHoodlefinanceAppScriptBindings(scope, services);

  assert.equal(typeof scope.HOODLEFINANCE_TS, "function");
  assert.equal(typeof scope.HOODLEFINANCE_TS_ENVELOPE, "function");
  assert.equal(
    typeof scope.hoodlefinanceBuildSheetsAddOnHomepage,
    "function",
  );
  assert.equal(scope.HOODLEFINANCE_TS("USDUSD", "price"), 1);
});
