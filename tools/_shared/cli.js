#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createUrlFetchApp } = require("./urlfetch-sync.js");

function loadHoodlefinance() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "hoodlefinance.js"),
    "utf8",
  );
  const cacheStore = new Map();
  const scriptPropertiesStore = new Map();
  const localCurrencyCodesPath = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "currency-codes.json",
  );
  const localPseIsinMapPath = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "pse-isin-map.properties",
  );

  scriptPropertiesStore.set(
    "hoodlefinance.currencyCodes",
    fs.readFileSync(localCurrencyCodesPath, "utf8"),
  );
  scriptPropertiesStore.set(
    "hoodlefinance.currencyCodesFetchedAtMs",
    String(Date.now()),
  );
  scriptPropertiesStore.set(
    "hoodlefinance.pseIsinMap",
    JSON.stringify({
      fetchedAtMs: Date.now(),
      text: fs.readFileSync(localPseIsinMapPath, "utf8"),
    }),
  );

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
            return scriptPropertiesStore.has(key)
              ? scriptPropertiesStore.get(key)
              : null;
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

  return runtime.hf_getRoutingTableRows_();
}

function formatRoutingTable(rows) {
  return [["classification", "example", "planned route"]]
    .concat(
      rows.map(function (row) {
        return [row.classification, row.example, row.route];
      }),
    )
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
  const startedAtMs = Date.now();
  const ticker = String(symbol).trim();
  const RequestInput = runtime.HOODLEFINANCE_ROUTING_TYPES_
    ? runtime.HOODLEFINANCE_ROUTING_TYPES_.RequestInput
    : null;
  const plannedRouteParts = [];
  let requestInput;
  let resolvedRequest;
  let identifierPlan;
  let attributePlan;
  let identifierJob;
  let attributeJob;
  let runtimeTrace;
  let plannedRoute;
  let resultValue;
  let resultError;
  const job = runtime.hf_createQuoteRouteJob_(ticker, "price");

  if (
    RequestInput &&
    runtime.hf_resolveIdentifierDirect_ &&
    runtime.hf_buildIdentifierResolutionPlan_ &&
    runtime.hf_buildQuoteRoutePlanForResolvedRequest_ &&
    runtime.hf_createResolverRouteJob_ &&
    runtime.hf_prepareResolverJob_
  ) {
    try {
      requestInput = new RequestInput(ticker, "price");

      if (requestInput.infoMode) {
        job.plan = runtime.hf_classifyTickerJob_(job.tickerInput, "price");

        if (Object.prototype.hasOwnProperty.call(job.plan || {}, "debugValue")) {
          return {
            ok: true,
            plannedRoute: String(job.plan.debugValue || ""),
            totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
            runtimeTrace: [],
            value: null,
          };
        }
      }

      resolvedRequest = runtime.hf_resolveIdentifierDirect_(requestInput);

      if (!resolvedRequest) {
        identifierPlan = runtime.hf_buildIdentifierResolutionPlan_(requestInput);

        if (!identifierPlan) {
          throw new Error("Identifier resolution failed.");
        }

        plannedRouteParts.push(
          runtime.hf_describePlanSource_(identifierPlan.buildRuntimePlan(requestInput)),
        );

        identifierJob = runtime.hf_createResolverRouteJob_(requestInput);
        runtime.hf_prepareResolverJob_(identifierJob, identifierPlan, requestInput);
        runtime.hf_executeRouteJobs_([identifierJob]);

        if (identifierJob.error) {
          throw new Error(identifierJob.error);
        }

        resolvedRequest = identifierJob.value;

        if (!resolvedRequest) {
          throw new Error("Identifier resolution failed.");
        }
      }

      attributePlan = runtime.hf_buildQuoteRoutePlanForResolvedRequest_(
        requestInput,
        resolvedRequest,
      );
      plannedRouteParts.push(
        runtime.hf_describePlanSource_(attributePlan.buildRuntimePlan(resolvedRequest)),
      );

      attributeJob = runtime.hf_createResolverRouteJob_(resolvedRequest);
      runtime.hf_prepareResolverJob_(attributeJob, attributePlan, resolvedRequest);
      runtime.hf_executeRouteJobs_([attributeJob]);

      resultError = attributeJob.error || "";
      resultValue = attributeJob.quote || null;
      runtimeTrace = []
        .concat(identifierJob && identifierJob.routeRuntimeTrace
          ? identifierJob.routeRuntimeTrace
          : [])
        .concat(attributeJob.routeRuntimeTrace || []);
      plannedRoute = plannedRouteParts.filter(Boolean).join(" => ");

      return {
        error: resultError,
        ok: !resultError,
        plannedRoute: plannedRoute || "(none)",
        totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
        runtimeTrace: runtimeTrace.map(function (entry) {
          return {
            elapsedMs:
              entry && entry.elapsedMs != null && isFinite(entry.elapsedMs)
                ? Number(entry.elapsedMs)
                : null,
            label: String((entry && entry.label) || ""),
            status: String((entry && entry.status) || ""),
          };
        }),
        value: resultValue,
      };
    } catch (error) {
      return {
        error: error && error.message ? error.message : String(error),
        ok: false,
        plannedRoute: plannedRouteParts.filter(Boolean).join(" => "),
        totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
        runtimeTrace: []
          .concat(identifierJob && identifierJob.routeRuntimeTrace
            ? identifierJob.routeRuntimeTrace
            : [])
          .concat(attributeJob && attributeJob.routeRuntimeTrace
            ? attributeJob.routeRuntimeTrace
            : [])
          .map(function (entry) {
            return {
              elapsedMs:
                entry && entry.elapsedMs != null && isFinite(entry.elapsedMs)
                  ? Number(entry.elapsedMs)
                  : null,
              label: String((entry && entry.label) || ""),
              status: String((entry && entry.status) || ""),
            };
          }),
        value: null,
      };
    }
  }

  try {
    job.plan = runtime.hf_classifyTickerJob_(job.tickerInput, "price");
  } catch (error) {
    return {
      error: error && error.message ? error.message : String(error),
      ok: false,
      plannedRoute: "",
      totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
      runtimeTrace: [],
      value: null,
    };
  }

  if (Object.prototype.hasOwnProperty.call(job.plan || {}, "debugValue")) {
    return {
      ok: true,
      plannedRoute: String(job.plan.debugValue || ""),
      totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
      runtimeTrace: [],
      value: null,
    };
  }

  runtime.hf_prepareRouteJob_(job, job.plan);

  try {
    runtime.hf_executeRouteJobs_([job]);
  } catch (error) {
    job.error = error && error.message ? error.message : String(error);
  }

  return {
    error: job.error || "",
    ok: !job.error,
    plannedRoute: runtime.hf_describePlanSource_(job.plan),
    totalElapsedMs: Math.max(0, Date.now() - startedAtMs),
    runtimeTrace: (job.routeRuntimeTrace || []).map(function (entry) {
      return {
        elapsedMs:
          entry && entry.elapsedMs != null && isFinite(entry.elapsedMs)
            ? Number(entry.elapsedMs)
            : null,
        label: String((entry && entry.label) || ""),
        status: String((entry && entry.status) || ""),
      };
    }),
    value: job.quote || null,
  };
}

function formatTraceResultSummary(trace) {
  const totalElapsedMs =
    trace && trace.totalElapsedMs != null && isFinite(trace.totalElapsedMs)
      ? Math.max(0, Number(trace.totalElapsedMs))
      : 0;
  const runtimeTrace = trace && Array.isArray(trace.runtimeTrace)
    ? trace.runtimeTrace
    : [];
  let accountedMs = 0;
  let slackMs;
  let slackRatio;
  let summary;
  let i;

  for (i = 0; i < runtimeTrace.length; i += 1) {
    if (runtimeTrace[i] && runtimeTrace[i].elapsedMs != null && isFinite(runtimeTrace[i].elapsedMs)) {
      accountedMs += Math.max(0, Number(runtimeTrace[i].elapsedMs));
    }
  }

  slackMs = Math.max(0, totalElapsedMs - accountedMs);
  slackRatio = totalElapsedMs > 0 ? slackMs / totalElapsedMs : 0;
  summary = totalElapsedMs + "ms total";

  if (slackMs > 0 && slackRatio > 0.01) {
    summary += ", " + slackMs + "ms slack";
  }

  return summary;
}

function formatRoutingTrace(trace) {
  if (!trace.runtimeTrace.length) {
    return "(no runtime trace)";
  }

  return trace.runtimeTrace
    .map(function (entry) {
      const parts = [entry.status];

      if (entry.elapsedMs != null && isFinite(entry.elapsedMs)) {
        parts.push(String(entry.elapsedMs) + "ms");
      }

      return entry.label + " [" + parts.join(", ") + "]";
    })
    .join(" -> ");
}

function formatTraceOutput(symbol, ctx) {
  const trace = traceRoutingForSymbol(symbol, ctx);
  const lines = [
    "symbol: " + symbol,
    "planned route: " + (trace.plannedRoute || "(none)"),
    "runtime trace: " + formatRoutingTrace(trace),
  ];

  if (trace.ok) {
    lines.push("result: success (" + formatTraceResultSummary(trace) + ")");
  } else {
    lines.push("result: error (" + formatTraceResultSummary(trace) + ")");
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
  formatTraceResultSummary,
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
