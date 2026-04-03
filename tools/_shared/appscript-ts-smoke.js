#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createUrlFetchApp } = require("./urlfetch-sync.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const options = {
    minify: false,
  };

  for (const arg of argv) {
    if (arg === "--minify") {
      options.minify = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function createScriptCache() {
  const cache = new Map();

  return {
    get(key) {
      return cache.has(key) ? cache.get(key) : null;
    },
    put(key, value) {
      cache.set(key, String(value));
    },
  };
}

function createSandbox() {
  const scriptCache = createScriptCache();
  const urlFetchApp = createUrlFetchApp();
  const sandbox = {
    CacheService: {
      getScriptCache() {
        return scriptCache;
      },
    },
    Date,
    Error,
    JSON,
    Math,
    Object,
    RegExp,
    String,
    UrlFetchApp: {
      fetch(url) {
        return urlFetchApp.fetch(url);
      },
      fetchAll(requests) {
        return requests.map((request) =>
          urlFetchApp.fetch(typeof request === "string" ? request : request.url),
        );
      },
    },
    console,
  };

  sandbox.globalThis = sandbox;
  return sandbox;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const bundlePath = path.join(
    ROOT_DIR,
    "dist",
    options.minify ? "appscript-min" : "appscript",
    "hoodlefinance-ts.js",
  );
  const source = fs.readFileSync(bundlePath, "utf8");
  const sandbox = createSandbox();
  const cases = [
    {
      attribute: "price",
      ticker: "GOOG",
      validate(value) {
        if (!Number.isFinite(value)) {
          throw new Error("expected GOOG to return a live quote");
        }
      },
    },
    {
      attribute: "price",
      ticker: "USDUSD",
      validate(value) {
        if (value !== 1) {
          throw new Error("expected USDUSD to resolve to a 1.0 quote");
        }
      },
    },
    {
      attribute: "price",
      ticker: "PSE:BDO",
      validate(value) {
        if (!Number.isFinite(value)) {
          throw new Error("expected PSE:BDO to return a live quote");
        }
      },
    },
  ];
  const failures = [];

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance-ts.js" });

  for (const smokeCase of cases) {
    try {
      smokeCase.validate(
        sandbox.HOODLEFINANCE_TS(smokeCase.ticker, smokeCase.attribute),
      );
    } catch (error) {
      failures.push(
        `${smokeCase.ticker} ${smokeCase.attribute}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write(failures.join("\n") + "\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`smoke: ${cases.length}/${cases.length} passed\n`);
}

main();
