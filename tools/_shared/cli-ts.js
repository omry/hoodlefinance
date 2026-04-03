#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
  YahooQuoteResolver,
} = require("../../dist/ts/core/concrete-resolvers.js");
const {
  buildTypedRequestFromParsedInput,
  createRequestInput,
  extractIsinFromRequestInput,
} = require("../../dist/ts/core/request-building.js");
const {
  extractAttributeValue,
} = require("../../dist/ts/core/attribute-extraction.js");
const { isSameCurrencyFxPair } = require("../../dist/ts/core/fx-quotes.js");
const { describePlanSource } = require("../../dist/ts/core/route-results.js");
const fs = require("node:fs");
const { createUrlFetchApp } = require("../../tools/_shared/urlfetch-sync.js");

function loadTextFile(path) {
  return fs.readFileSync(path, "utf8");
}

function parsePropertiesMap(text) {
  const output = {};

  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim().toUpperCase();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key) {
      output[key] = value;
    }
  }

  return output;
}

function loadPseIsinMap() {
  const dataPath = `${__dirname}/../../data/pse-isin-map.properties`;

  return parsePropertiesMap(loadTextFile(dataPath));
}

function createSyncFetcher() {
  const urlFetchApp = createUrlFetchApp();

  return (url) => {
    try {
      return urlFetchApp.fetch(url).getContentText();
    } catch (error) {
      throw new Error(
        `Failed to fetch "${url}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}

function createStringCache() {
  const cache = new Map();

  return {
    getCachedString(key) {
      return cache.get(key) || "";
    },
    putCachedString(key, value) {
      cache.set(key, String(value || ""));
      return String(value || "");
    },
  };
}

function createJsonCache() {
  const cache = new Map();

  return {
    getCachedJson(key) {
      return cache.has(key) ? cache.get(key) : null;
    },
    putCachedJson(key, value) {
      cache.set(key, value);
      return value;
    },
  };
}

function createCliEnvironment() {
  const syncFetchText = createSyncFetcher();
  const stringCache = createStringCache();
  const jsonCache = createJsonCache();
  const pseIsinMap = loadPseIsinMap();

  return {
    directIdentifierResolver: new DirectIdentifierResolver(),
    googleFxResolver: new GoogleFxResolver({
      fetchText: syncFetchText,
      getCachedJson: jsonCache.getCachedJson,
      putCachedJson: jsonCache.putCachedJson,
    }),
    localFxResolver: new LocalFxResolver(),
    pseIsinMapResolver: new PseIsinMapResolver((isin) =>
      pseIsinMap[String(isin || "").trim().toUpperCase()] || "",
    ),
    yahooQuoteResolver: new YahooQuoteResolver({
      fetchAllInChunks(_source, requests) {
        return requests.map((request) => ({
          request,
          response: {
            getContentText() {
              return syncFetchText(request.url);
            },
            getResponseCode() {
              return 200;
            },
          },
        }));
      },
      getCachedJson: jsonCache.getCachedJson,
      putCachedJson: jsonCache.putCachedJson,
    }),
    yahooIsinSearchResolver: new YahooIsinSearchResolver({
      fetchAllInChunks(_source, requests) {
        return requests.map((request) => ({
          request,
          response: {
            getContentText() {
              return syncFetchText(request.url);
            },
            getResponseCode() {
              return 200;
            },
          },
        }));
      },
      getCachedString: stringCache.getCachedString,
      putCachedString: stringCache.putCachedString,
    }),
  };
}

function routeLabelFromPlan(routeClass, routePath) {
  return describePlanSource({
    routeClass,
    routePath,
  });
}

function routeLabelFromLookup(result) {
  return result.route || "(none)";
}

function applyRequestedAttribute(result, attribute) {
  if (result.status !== "success" || result.kind !== "quote") {
    return result;
  }

  try {
    const value = extractAttributeValue(
      result.value || {},
      String(attribute || "price"),
    );

    return {
      ...result,
      value,
    };
  } catch (error) {
    return {
      ...result,
      error: error instanceof Error ? error.message : String(error),
      status: "failure",
      value: null,
    };
  }
}

function resolveQuoteForResolvedRequest(env, resolvedRequest, attemptedRoutes) {
  if (resolvedRequest && resolvedRequest.requestType === "fx") {
    const routePath = isSameCurrencyFxPair(resolvedRequest.fxPair)
      ? env.localFxResolver.name
      : env.googleFxResolver.name;
    const routeLabel = routeLabelFromPlan("FX", routePath);
    const outcome = isSameCurrencyFxPair(resolvedRequest.fxPair)
      ? env.localFxResolver.resolve(resolvedRequest)
      : env.googleFxResolver.resolve(resolvedRequest);

    return {
      ...outcome,
      attemptedRoutes: attemptedRoutes.concat([routeLabel]),
      kind: "quote",
      route: routeLabel,
    };
  }

  if (env.yahooQuoteResolver.canHandle(resolvedRequest)) {
    const routeLabel = routeLabelFromPlan(
      env.yahooQuoteResolver.getRouteClass(resolvedRequest),
      env.yahooQuoteResolver.name,
    );
    const outcome = env.yahooQuoteResolver.resolve(resolvedRequest);

    return {
      ...outcome,
      attemptedRoutes: attemptedRoutes.concat([routeLabel]),
      kind: "quote",
      route: routeLabel,
    };
  }

  return {
    attemptedRoutes,
    error: "Quote lookup is not yet available for this request in the TypeScript CLI.",
    kind: "quote",
    route: attemptedRoutes[attemptedRoutes.length - 1] || "(none)",
    status: "failure",
  };
}

function resolveFxRequest(env, requestInput) {
  const resolvedRequest = buildTypedRequestFromParsedInput(
    requestInput,
    requestInput,
    0,
  );
  return resolveQuoteForResolvedRequest(env, resolvedRequest, []);
}

function resolveIsinRequest(env, requestInput) {
  const isin = extractIsinFromRequestInput(requestInput);
  const attemptedRoutes = [];
  const routeClass = "IDENTIFIER:ISIN";

  if (isin.startsWith("PH")) {
    const routeLabel = routeLabelFromPlan(routeClass, env.pseIsinMapResolver.name);
    attemptedRoutes.push(routeLabel);
    const pseOutcome = env.pseIsinMapResolver.resolve(requestInput);

    if (pseOutcome.status === "success") {
      return {
        ...resolveQuoteForResolvedRequest(env, pseOutcome.value, attemptedRoutes),
      };
    }
  }

  const routeLabel = routeLabelFromPlan(
    routeClass,
    env.yahooIsinSearchResolver.name,
  );
  attemptedRoutes.push(routeLabel);
  const yahooOutcome = env.yahooIsinSearchResolver.resolve(requestInput);

  if (yahooOutcome.status !== "success") {
    return {
      ...yahooOutcome,
      attemptedRoutes,
      kind: "quote",
      route: routeLabel,
    };
  }

  return {
    ...resolveQuoteForResolvedRequest(env, yahooOutcome.value, attemptedRoutes),
  };
}

function resolveDirectRequest(env, requestInput) {
  const outcome = env.directIdentifierResolver.resolve(requestInput);
  const routeLabel = routeLabelFromPlan(
    env.directIdentifierResolver.name,
    "",
  );

  if (outcome.status !== "success") {
    return {
      ...outcome,
      attemptedRoutes: [routeLabel],
      kind: "quote",
      route: routeLabel,
    };
  }

  return {
    ...resolveQuoteForResolvedRequest(env, outcome.value, [routeLabel]),
  };
}

function lookupWithEnvironment(env, args) {
  const attribute = String(args.attribute || "price").trim();
  const requestInput = createRequestInput(args.ticker, attribute);

  if (requestInput.classification === "fx" && requestInput.fxPair) {
    return applyRequestedAttribute(resolveFxRequest(env, requestInput), attribute);
  }

  if (extractIsinFromRequestInput(requestInput)) {
    return applyRequestedAttribute(
      resolveIsinRequest(env, requestInput),
      attribute,
    );
  }

  return applyRequestedAttribute(resolveDirectRequest(env, requestInput), attribute);
}

function formatLookupResult(result) {
  if (result.status !== "success") {
    return null;
  }

  if (result.value instanceof Date) {
    return result.value;
  }

  if (result.value && typeof result.value === "object") {
    return JSON.parse(JSON.stringify(result.value));
  }

  return result.value;
}

function formatRoutingTable() {
  return [
    ["classification", "example", "route"],
    ["equity", "GOOG", routeLabelFromPlan("DIRECT-IDENTIFIER", "")],
    ["fx", "USDUSD", routeLabelFromPlan("FX", "LOCAL")],
    ["fx", "EURUSD", routeLabelFromPlan("FX", "GOOGLE")],
    [
      "isin",
      "US02079K1079",
      routeLabelFromPlan("IDENTIFIER:ISIN", "YAHOO-ISIN"),
    ],
    [
      "isin",
      "PHY077751022",
      routeLabelFromPlan("IDENTIFIER:ISIN", "PSE-MAP"),
    ],
  ]
    .map((columns) => columns.join("\t"))
    .join("\n");
}

function formatRoutingTree() {
  const lines = [
    "ROOT",
    "├── DIRECT-IDENTIFIER",
    "├── IDENTIFIER",
    "│   └── IDENTIFIER:ISIN",
    "│       ├── PSE-MAP",
    "│       └── YAHOO-ISIN",
    "└── FX",
    "    ├── FX-SAME",
    "    │   └── LOCAL",
    "    └── FX",
    "        └── GOOGLE",
  ];

  return lines.join("\n");
}

function runSmokeSuite(env = createCliEnvironment()) {
  const cases = [
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected GOOG to return a live quote");
        }
      },
      ticker: "GOOG",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (result.value !== 1) {
          throw new Error("expected USDUSD to resolve to a 1.0 quote");
        }
      },
      ticker: "USDUSD",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected EURUSD to return a live quote");
        }
      },
      ticker: "EURUSD",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected Yahoo ISIN lookup to return a live quote");
        }
      },
      ticker: "US02079K1079",
    },
  ];
  const failures = [];

  for (const smokeCase of cases) {
    try {
      smokeCase.expected(
        lookupWithEnvironment(env, {
          attribute: smokeCase.attribute,
          ticker: smokeCase.ticker,
        }),
      );
    } catch (error) {
      failures.push(
        `${smokeCase.ticker} ${smokeCase.attribute}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    failures,
    passed: cases.length - failures.length,
    total: cases.length,
  };
}

function printUsage() {
  console.error("Usage: npm run hoodlefinance.ts -- <ticker> [attribute]");
  console.error("       npm run hoodlefinance.ts -- --routing");
  console.error("       npm run hoodlefinance.ts -- --routing-table");
  console.error("       npm run hoodlefinance.ts -- --trace <symbol>");
  console.error("       npm run smoke.ts -- --smoke");
}

function formatRoutingTrace(result) {
  return result.attemptedRoutes && result.attemptedRoutes.length
    ? result.attemptedRoutes.join(" -> ")
    : "(no runtime trace)";
}

function formatTraceOutput(symbol, result) {
  const lines = [
    `symbol: ${symbol}`,
    `planned route: ${routeLabelFromLookup(result)}`,
    `runtime trace: ${formatRoutingTrace(result)}`,
  ];

  if (result.status === "success") {
    lines.push("result: success");
    return lines.join("\n");
  }

  lines.push("result: error");
  lines.push(`error: ${result.error}`);
  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  const [firstArg, secondArg, thirdArg] = argv;
  const env = createCliEnvironment();

  if (!firstArg) {
    printUsage();
    process.exit(1);
  }

  if (firstArg === "--routing-table" || firstArg === "routing-table") {
    console.log(formatRoutingTable());
    return;
  }

  if (
    firstArg === "--routing" ||
    firstArg === "routing" ||
    firstArg === "--routing-tree" ||
    firstArg === "routing-tree"
  ) {
    console.log(formatRoutingTree());
    return;
  }

  if (firstArg === "--smoke" || firstArg === "smoke") {
    const smoke = runSmokeSuite(env);

    for (const failure of smoke.failures) {
      console.error(failure);
    }

    console.log(`smoke: ${smoke.passed}/${smoke.total} passed`);
    process.exit(smoke.failures.length ? 1 : 0);
  }

  if (firstArg === "--trace" || firstArg === "trace") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const result = lookupWithEnvironment(env, {
      attribute: thirdArg || "price",
      ticker: secondArg,
    });
    console.log(formatTraceOutput(secondArg, result));

    if (result.status !== "success") {
      process.exit(1);
    }

    return;
  }

  const result = lookupWithEnvironment(env, {
    attribute: secondArg || "price",
    ticker: firstArg,
  });
  if (result.status !== "success") {
    console.error(result.error);
    process.exit(1);
  }

  const formattedResult = formatLookupResult(result);

  if (formattedResult instanceof Date) {
    console.log(formattedResult.toISOString());
    return;
  }

  console.log(formattedResult);
}

if (require.main === module) {
  main();
}

module.exports = {
  createCliEnvironment,
  formatLookupResult,
  formatTraceOutput,
  formatRoutingTrace,
  formatRoutingTable,
  formatRoutingTree,
  lookupWithEnvironment,
  main,
  runSmokeSuite,
};
