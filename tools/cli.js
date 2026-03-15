#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createUrlFetchApp } = require("./urlfetch-sync.js");

function loadHoodlefinance() {
  const source = fs.readFileSync(path.join(__dirname, "..", "hoodlefinance.js"), "utf8");
  const cacheStore = new Map();
  const scriptPropertiesStore = new Map();
  const localCurrencyCodesPath = path.join(__dirname, "..", "data", "currency-codes.json");

  scriptPropertiesStore.set("hoodlefinance.currencyCodes", fs.readFileSync(localCurrencyCodesPath, "utf8"));
  scriptPropertiesStore.set("hoodlefinance.currencyCodesFetchedAtMs", String(Date.now()));

  const sandbox = {
    console,
    Date,
    JSON,
    encodeURIComponent,
    Array,
    String,
    Object,
    RegExp,
    Error,
    Map,
    CacheService: {
      getScriptCache() {
        return {
          get(key) {
            return cacheStore.has(key) ? cacheStore.get(key) : null;
          },
          put(key, value) {
            cacheStore.set(key, value);
          },
        };
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          deleteProperty(key) {
            scriptPropertiesStore.delete(key);
          },
          getProperty(key) {
            return scriptPropertiesStore.has(key) ? scriptPropertiesStore.get(key) : null;
          },
          setProperty(key, value) {
            scriptPropertiesStore.set(key, String(value));
          },
        };
      },
    },
    UrlFetchApp: createUrlFetchApp(),
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

function runLookup(ticker, attribute) {
  const ctx = loadHoodlefinance();
  const normalizedAttribute = attribute || "price";

  try {
    const result = ctx.HOODLEFINANCE(ticker, normalizedAttribute);
    return {
      ok: true,
      value: result,
    };
  } catch (error) {
    return {
      error: error && error.message ? error.message : String(error),
      ok: false,
      value: null,
    };
  }
}

function main() {
  const ticker = process.argv[2];
  const attribute = process.argv[3] || "price";
  if (!ticker) {
    console.error("Usage: node cli.js <ticker> [attribute]");
    process.exit(1);
  }

  const lookup = runLookup(ticker, attribute);

  if (!lookup.ok) {
    console.error(lookup.error);
    process.exit(1);
  }

  try {
    const result = lookup.value;
    if (result instanceof Date) {
      console.log(result.toISOString());
      return;
    }
    console.log(result);
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  loadHoodlefinance,
  runLookup,
};

if (require.main === module) {
  main();
}
