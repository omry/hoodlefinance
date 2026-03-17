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

function getRoutingTableRows(ctx) {
  const runtime = ctx || loadHoodlefinance();

  return runtime.hoodlefinanceGetRoutingTableRows_();
}

function formatRoutingTable(rows) {
  return [["classification", "example", "planned route"]]
    .concat(rows.map(function (row) {
      return [row.classification, row.example, row.route];
    }))
    .map(function (columns) {
      return columns.join("\t");
    })
    .join("\n");
}

function printRoutingTable() {
  console.log(formatRoutingTable(getRoutingTableRows()));
}

function traceRoutingForSymbol(symbol, ctx) {
  const runtime = ctx || loadHoodlefinance();
  const job = runtime.hoodlefinanceCreateQuoteRouteJob_(String(symbol).trim(), "price");

  try {
    job.plan = runtime.hoodlefinanceClassifyTickerJob_(job.tickerInput, "price");
  } catch (error) {
    return {
      error: error && error.message ? error.message : String(error),
      ok: false,
      plannedRoute: "",
      runtimeTrace: [],
      value: null,
    };
  }

  if (Object.prototype.hasOwnProperty.call(job.plan || {}, "debugValue")) {
    return {
      ok: true,
      plannedRoute: String(job.plan.debugValue || ""),
      runtimeTrace: [],
      value: null,
    };
  }

  runtime.hoodlefinancePrepareRouteJob_(job, job.plan);

  try {
    runtime.hoodlefinanceExecuteRouteJobs_([job]);
  } catch (error) {
    job.error = error && error.message ? error.message : String(error);
  }

  return {
    error: job.error || "",
    ok: !job.error,
    plannedRoute: runtime.hoodlefinanceDescribePlanSource_(job.plan),
    runtimeTrace: (job.routeRuntimeTrace || []).map(function (entry) {
      return {
        label: String(entry && entry.label || ""),
        status: String(entry && entry.status || ""),
      };
    }),
    value: job.quote || null,
  };
}

function formatRoutingTrace(trace) {
  if (!trace.runtimeTrace.length) {
    return "(no runtime trace)";
  }

  return trace.runtimeTrace.map(function (entry) {
    return entry.label + " [" + entry.status + "]";
  }).join(" -> ");
}

function formatTraceOutput(symbol, ctx) {
  const trace = traceRoutingForSymbol(symbol, ctx);
  const lines = [
    "symbol: " + symbol,
    "planned route: " + (trace.plannedRoute || "(none)"),
    "runtime trace: " + formatRoutingTrace(trace),
  ];

  if (trace.ok) {
    lines.push("result: success");
  } else {
    lines.push("result: error");
    lines.push("error: " + trace.error);
  }

  return lines.join("\n");
}

function main() {
  const ticker = process.argv[2];
  const attribute = process.argv[3] || "price";

  if (ticker === "--routing-table") {
    printRoutingTable();
    return;
  }

  if (ticker === "--trace") {
    if (!process.argv[3]) {
      console.error("Usage: node cli.js --trace <symbol>");
      process.exit(1);
    }

    console.log(formatTraceOutput(process.argv[3]));
    return;
  }

  if (!ticker) {
    console.error("Usage: node cli.js <ticker> [attribute]");
    console.error("       node cli.js --routing-table");
    console.error("       node cli.js --trace <symbol>");
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
  formatRoutingTable,
  formatTraceOutput,
  formatRoutingTrace,
  getRoutingTableRows,
  loadHoodlefinance,
  printRoutingTable,
  runLookup,
  traceRoutingForSymbol,
};

if (require.main === module) {
  main();
}
