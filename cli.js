#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const childProcess = require("node:child_process");

function loadHoodlefinance() {
  const source = fs.readFileSync(path.join(__dirname, "hoodlefinance.js"), "utf8");
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
        const output = childProcess.execFileSync("curl", ["-Ls", url], {
          encoding: "utf8",
        });

        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return output;
          },
        };
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

function main() {
  const ticker = process.argv[2];
  const attribute = process.argv[3] || "price";
  const ctx = loadHoodlefinance();

  if (!ticker) {
    console.error("Usage: node cli.js <ticker> [attribute]");
    process.exit(1);
  }

  try {
    const result = ctx.HOODLEFINANCE(ticker, attribute);
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

main();
