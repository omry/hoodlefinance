#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const childProcess = require("child_process");

function loadHoodlefinance() {
  const source = fs.readFileSync(path.join(__dirname, "..", "hoodlefinance.js"), "utf8");
  const cacheStore = new Map();
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
    UrlFetchApp: {
      fetch(url) {
        const output = childProcess.execFileSync(
          "curl",
          [
            "-Ls",
            "-H",
            "User-Agent: Mozilla/5.0",
            "-H",
            "Accept-Language: en-US,en;q=0.9",
            "-w",
            "\n__HOODLEFINANCE_STATUS__:%{http_code}\n",
            url,
          ],
          {
            encoding: "utf8",
          }
        );
        const match = output.match(/\n__HOODLEFINANCE_STATUS__:(\d{3})\n$/);
        const body = match ? output.slice(0, match.index) : output;
        const statusCode = match ? Number(match[1]) : 0;

        return {
          getResponseCode() {
            return statusCode;
          },
          getContentText() {
            return body;
          },
        };
      },
    },
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
