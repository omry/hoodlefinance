#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const {
  createHoodlefinanceRuntime,
  createPreferredYahooSymbolResolver,
  parsePreferredReitTickerSet,
  parsePropertiesMap,
} = require("../../dist/ts/runtime/host-adapter.js");
const { createRequestInput } = require("../../dist/ts/core/request-building.js");
const { looksLikeIsin } = require("../../dist/ts/core/request.js");
const {
  resolveRequestEnvelope,
  resolveRequestValue,
} = require("../../dist/ts/core/request-resolution.js");
const { describePlanSource } = require("../../dist/ts/core/route-results.js");
const {
  buildRoutingPlanTreeNode,
  buildRoutingTableGrid,
} = require("../../dist/ts/core/routing-introspection.js");
const fs = require("node:fs");
const { createUrlFetchApp } = require("../../tools/_shared/urlfetch-sync.js");

function loadTextFile(path) {
  return fs.readFileSync(path, "utf8");
}

function loadPseIsinMap() {
  const dataPath = `${__dirname}/../../data/pse-isin-map.properties`;

  return parsePropertiesMap(loadTextFile(dataPath));
}

function loadPreferredReitTickerSet() {
  const dataPath = `${__dirname}/../../data/preferred-reit-whitelist.json`;

  return parsePreferredReitTickerSet(loadTextFile(dataPath));
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
  const pseIsinMap = loadPseIsinMap();
  const preferredReitTickerSet = loadPreferredReitTickerSet();
  const stringCache = createStringCache();
  const jsonCache = createJsonCache();
  const runtime = createHoodlefinanceRuntime({
    fetchText: syncFetchText,
    getCachedJson: jsonCache.getCachedJson,
    getCachedString: stringCache.getCachedString,
    putCachedJson: jsonCache.putCachedJson,
    putCachedString: stringCache.putCachedString,
    resolvePreferredYahooSymbol: createPreferredYahooSymbolResolver(
      preferredReitTickerSet,
    ),
    resolvePseTickerFromIsinMap(isin) {
      return pseIsinMap[String(isin || "").trim().toUpperCase()] || "";
    },
  });

  return {
    ...runtime,
    getCachedString: stringCache.getCachedString,
    looksLikeIsin,
    putCachedString: stringCache.putCachedString,
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

function lookupEnvelopeWithEnvironment(env, args) {
  return resolveRequestEnvelope(
    env,
    createRequestInput(args.ticker, String(args.attribute || "price").trim()),
  );
}

function lookupWithEnvironment(env, args) {
  return resolveRequestValue(
    env,
    createRequestInput(args.ticker, String(args.attribute || "price").trim()),
  );
}

function lookupWithGraphEnvironment(env, args) {
  return env.lookupViaGraph(
    args.ticker,
    String(args.attribute || "price").trim(),
  );
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

function formatEnvelopeResult(result) {
  return JSON.stringify(
    result,
    (_key, value) => {
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
        };
      }

      return value;
    },
    2,
  );
}

function formatRoutingTable(env = createCliEnvironment()) {
  const grid = buildRoutingTableGrid({
    buildResolvePlan: env.buildResolvePlan,
    createRequestInput,
  }).map((row, index) =>
    index === 0 ? ["classification", "example", "route"] : row,
  );

  return grid.map((columns) => columns.join("\t")).join("\n");
}

function formatRoutingTreeNode(node, prefix = "", isLast = true, isRoot = false) {
  const connector = isRoot ? "" : isLast ? "└── " : "├── ";
  const nextPrefix = isRoot ? "" : `${prefix}${isLast ? "    " : "│   "}`;
  const kindSuffix = node.kind === "leaf" ? "" : ` [${node.kind}]`;
  const lines = [`${prefix}${connector}${node.label}${kindSuffix}`];

  node.children.forEach((child, index) => {
    lines.push(
      formatRoutingTreeNode(
        child,
        nextPrefix,
        index === node.children.length - 1,
        false,
      ),
    );
  });

  return lines.join("\n");
}

function formatRoutingTree(env = createCliEnvironment()) {
  const rootNode = buildRoutingPlanTreeNode({
    getRoutingNodes() {
      return [
        env.getPlanNodeByCode("IDENTIFIER-ROOT"),
        env.getPlanNodeByCode("DEFAULT-ATTRIBUTE"),
      ];
    },
    getRoutingNodeKind() {
      return "switch";
    },
    name: "ROOT",
    routingLabel: "ROOT",
  });
  return formatRoutingTreeNode(rootNode, "", true, true);
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
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected PSE ISIN map lookup to return a live quote");
        }
      },
      ticker: "PHY077751022",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected TradingView fallback to return a live quote");
        }
      },
      ticker: "TLV:KSMF59",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected PSE lookup to return a live quote");
        }
      },
      ticker: "PSE:BDO",
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
  console.error("       npm run hoodlefinance.ts -- --envelope <ticker> [attribute]");
  console.error("       npm run hoodlefinance.ts -- --graph <ticker> [attribute]");
  console.error("       npm run hoodlefinance.ts -- --compare <ticker> [attribute]");
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
  let env = null;
  function getEnv() {
    if (!env) {
      env = createCliEnvironment();
    }

    return env;
  }

  if (!firstArg) {
    printUsage();
    process.exit(1);
  }

  if (firstArg === "--routing-table") {
    console.log("NOT IMPLEMENTED");
    return;
  }

  if (firstArg === "--routing" || firstArg === "--routing-tree") {
    console.log(formatRoutingTree(getEnv()));
    return;
  }

  if (firstArg === "--envelope") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const result = lookupEnvelopeWithEnvironment(getEnv(), {
      attribute: thirdArg || "price",
      ticker: secondArg,
    });
    console.log(formatEnvelopeResult(result));
    return;
  }

  if (firstArg === "--graph") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const result = lookupWithGraphEnvironment(getEnv(), {
      attribute: thirdArg || "price",
      ticker: secondArg,
    });
    console.log(formatEnvelopeResult(result));

    if (result.status !== "success") {
      process.exit(1);
    }

    return;
  }

  if (firstArg === "--compare") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const requestArgs = { attribute: thirdArg || "price", ticker: secondArg };
    const oldResult = lookupWithEnvironment(getEnv(), requestArgs);
    const newResult = lookupWithGraphEnvironment(getEnv(), requestArgs);

    console.log(`ticker: ${secondArg}  attribute: ${requestArgs.attribute}`);
    console.log(`old: status=${oldResult.status}  route=${oldResult.route}  value=${oldResult.value}`);
    console.log(`new: status=${newResult.status}  route=${newResult.route}  value=${newResult.value}`);

    const statusMatch = oldResult.status === newResult.status;
    const valueMatch = String(oldResult.value) === String(newResult.value);

    if (statusMatch && valueMatch) {
      console.log("parity: ok");
    } else {
      if (!statusMatch) console.error(`parity: status mismatch (${oldResult.status} vs ${newResult.status})`);
      if (!valueMatch) console.error(`parity: value mismatch (${oldResult.value} vs ${newResult.value})`);
      process.exit(1);
    }

    return;
  }

  if (firstArg === "--smoke") {
    const smoke = runSmokeSuite(getEnv());

    for (const failure of smoke.failures) {
      console.error(failure);
    }

    console.log(`smoke: ${smoke.passed}/${smoke.total} passed`);
    process.exit(smoke.failures.length ? 1 : 0);
  }

  if (firstArg === "--trace") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const result = lookupWithEnvironment(getEnv(), {
      attribute: thirdArg || "price",
      ticker: secondArg,
    });
    console.log(formatTraceOutput(secondArg, result));

    if (result.status !== "success") {
      process.exit(1);
    }

    return;
  }

  const result = lookupWithEnvironment(getEnv(), {
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
  formatEnvelopeResult,
  formatTraceOutput,
  formatRoutingTrace,
  formatRoutingTable,
  formatRoutingTree,
  lookupEnvelopeWithEnvironment,
  lookupWithEnvironment,
  lookupWithGraphEnvironment,
  main,
  runSmokeSuite,
};
