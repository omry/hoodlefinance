#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const {
  createHoodlefinanceRuntime,
} = require("../../dist/ts/runtime/host-adapter.js");
const {
  StandAloneResolverServices,
} = require("../../dist/ts/runtime/StandAloneResolverServices.js");
const { looksLikeIsin } = require("../../dist/ts/core/request.js");
const fs = require("node:fs");
const { createUrlFetchApp } = require("../../tools/_shared/urlfetch-sync.js");
const CURRENCY_CODES_CACHE_KEY = "hoodlefinance:currencyCodes";
const PREFERRED_REIT_WHITELIST_CACHE_KEY =
  "hoodlefinance:ts:preferredReitWhitelist";

function loadTextFile(path) {
  return fs.readFileSync(path, "utf8");
}

function loadPreferredReitWhitelistText() {
  const dataPath = `${__dirname}/../../data/preferred-reit-whitelist.json`;

  return loadTextFile(dataPath);
}

function loadCurrencyCodesText() {
  const dataPath = `${__dirname}/../../data/currency-codes.json`;

  return loadTextFile(dataPath);
}

function createSyncFetcher() {
  const urlFetchApp = createUrlFetchApp();

  return (url) => {
    try {
      return urlFetchApp.fetch(url);
    } catch (error) {
      throw new Error(
        `Failed to fetch "${url}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}

function createCliEnvironment() {
  const syncFetchText = createSyncFetcher();
  const resolverServices = new StandAloneResolverServices({
    httpFetch(url) {
      return syncFetchText(url);
    },
  });
  const env = {
    getCachedString(key) {
      return resolverServices.getCachedString(key);
    },
    httpFetch(url) {
      return resolverServices.httpFetch(url);
    },
    looksLikeIsin,
  };

  resolverServices.putCachedString(
    PREFERRED_REIT_WHITELIST_CACHE_KEY,
    loadPreferredReitWhitelistText(),
    21600,
  );
  resolverServices.putCachedString(
    CURRENCY_CODES_CACHE_KEY,
    loadCurrencyCodesText(),
    21600,
  );

  const runtime = createHoodlefinanceRuntime(resolverServices);

  Object.assign(env, {
    resolveAttribute: runtime.resolveAttribute,
  });

  return env;
}

function normalizeAttribute(attribute) {
  return String(attribute == null ? "price" : attribute).trim();
}

function resolveAttributeResultWithEnvironment(env, args) {
  try {
    return {
      error: "",
      status: "success",
      value: env.resolveAttribute(
        args.ticker,
        normalizeAttribute(args.attribute),
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      status: "failure",
      value: null,
    };
  }
}

function formatResolvedValue(result) {
  return result instanceof Date
    ? result
    : result && typeof result === "object"
      ? JSON.parse(JSON.stringify(result))
      : result;
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
        resolveAttributeResultWithEnvironment(env, {
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
  console.error("       npm run smoke.ts -- --smoke");
}

function main(argv = process.argv.slice(2)) {
  const [firstArg, secondArg] = argv;
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

  if (firstArg === "--smoke") {
    const smoke = runSmokeSuite(getEnv());

    for (const failure of smoke.failures) {
      console.error(failure);
    }

    console.log(`smoke: ${smoke.passed}/${smoke.total} passed`);
    process.exit(smoke.failures.length ? 1 : 0);
  }

  if (firstArg.startsWith("--")) {
    printUsage();
    process.exit(1);
  }

  let result;

  try {
    result = getEnv().resolveAttribute(firstArg, normalizeAttribute(secondArg));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const formattedResult = formatResolvedValue(result);

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
  resolveAttributeResultWithEnvironment,
  main,
  runSmokeSuite,
};
