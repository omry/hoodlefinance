/* SPDX-License-Identifier: MPL-2.0 */

declare const require: {
  (path: string): unknown;
  main?: unknown;
};
declare const module: { exports?: unknown };
declare const process: {
  argv: string[];
  exit(code?: number): never;
};
declare const __dirname: string;

import {
  DirectIdentifierResolver,
  GoogleFxResolver,
  LocalFxResolver,
  PseIsinMapResolver,
  YahooIsinSearchResolver,
} from "./core/concrete-resolvers";
import {
  buildTypedRequestFromParsedInput,
  createRequestInput,
  extractIsinFromRequestInput,
} from "./core/request-building";
import { isSameCurrencyFxPair } from "./core/fx-quotes";
import type { ResolutionResult } from "./core/planner";
import type { RequestInput } from "./core/request";
import type { FxRequest } from "./core/request";

const fs = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { createUrlFetchApp } = require("../../tools/_shared/urlfetch-sync.js") as {
  createUrlFetchApp(): {
    fetch(url: string): {
      getContentText(): string;
      getResponseCode(): number;
    };
    fetchAll(requests: Array<string | { url: string }>): Array<{
      getContentText(): string;
      getResponseCode(): number;
    }>;
  };
};

type CliOutcome<T> = ResolutionResult<T> & {
  route: string;
  attemptedRoutes: string[];
  kind: "quote" | "request";
};

export interface CliEnvironment {
  directIdentifierResolver: DirectIdentifierResolver;
  googleFxResolver: GoogleFxResolver;
  localFxResolver: LocalFxResolver;
  pseIsinMapResolver: PseIsinMapResolver;
  yahooIsinSearchResolver: YahooIsinSearchResolver;
}

export interface LookupArgs {
  attribute?: string;
  ticker: string;
}

interface CliSmokeCase {
  attribute: string;
  expected: (result: CliOutcome<unknown>) => void;
  ticker: string;
}

function loadTextFile(path: string): string {
  return fs.readFileSync(path, "utf8");
}

function parsePropertiesMap(text: string): Record<string, string> {
  const output: Record<string, string> = {};

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

function loadPseIsinMap(): Record<string, string> {
  const dataPath = `${__dirname}/../../data/pse-isin-map.properties`;
  return parsePropertiesMap(loadTextFile(dataPath));
}

function createSyncFetcher() {
  const urlFetchApp = createUrlFetchApp();

  return (url: string): string => {
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

function createStringCache(): {
  getCachedString(key: string): string;
  putCachedString(key: string, value: string): string;
} {
  const cache = new Map<string, string>();

  return {
    getCachedString(key: string): string {
      return cache.get(key) || "";
    },
    putCachedString(key: string, value: string): string {
      cache.set(key, String(value || ""));
      return String(value || "");
    },
  };
}

function createJsonCache(): {
  getCachedJson(key: string): unknown;
  putCachedJson(key: string, value: unknown): unknown;
} {
  const cache = new Map<string, unknown>();

  return {
    getCachedJson(key: string): unknown {
      return cache.has(key) ? cache.get(key) : null;
    },
    putCachedJson(key: string, value: unknown): unknown {
      cache.set(key, value);
      return value;
    },
  };
}

export function createCliEnvironment(): CliEnvironment {
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

function routeLabelFromLookup(result: CliOutcome<unknown>): string {
  return result.route || "(none)";
}

function resolveFxRequest(
  env: CliEnvironment,
  requestInput: RequestInput,
): CliOutcome<unknown> {
  const resolvedRequest = buildTypedRequestFromParsedInput(
    requestInput,
    requestInput,
    0,
  );
  const fxRequest = resolvedRequest as FxRequest;

  if (isSameCurrencyFxPair(fxRequest.fxPair)) {
    const outcome = env.localFxResolver.resolve(fxRequest);

    return {
      ...outcome,
      attemptedRoutes: ["FX -> LOCAL"],
      kind: "quote",
      route: "FX -> LOCAL",
    };
  }

  const outcome = env.googleFxResolver.resolve(fxRequest);

  return {
    ...outcome,
    attemptedRoutes: ["FX -> GOOGLE"],
    kind: "quote",
    route: "FX -> GOOGLE",
  };
}

function resolveIsinRequest(
  env: CliEnvironment,
  requestInput: RequestInput,
): CliOutcome<unknown> {
  const isin = extractIsinFromRequestInput(requestInput);
  const attemptedRoutes: string[] = [];

  if (isin.startsWith("PH")) {
    attemptedRoutes.push("IDENTIFIER:ISIN -> PSE-MAP");
    const pseOutcome = env.pseIsinMapResolver.resolve(requestInput);

    if (pseOutcome.status === "success") {
      return {
        ...pseOutcome,
        attemptedRoutes,
        kind: "request",
        route: attemptedRoutes[0] || "",
      };
    }
  }

  attemptedRoutes.push("IDENTIFIER:ISIN -> YAHOO-ISIN");
  const yahooOutcome = env.yahooIsinSearchResolver.resolve(requestInput);

  return {
    ...yahooOutcome,
    attemptedRoutes,
    kind: "request",
    route: attemptedRoutes[attemptedRoutes.length - 1] || "",
  };
}

function resolveDirectRequest(
  env: CliEnvironment,
  requestInput: RequestInput,
): CliOutcome<unknown> {
  const outcome = env.directIdentifierResolver.resolve(requestInput);

  return {
    ...outcome,
    attemptedRoutes: ["DIRECT-IDENTIFIER"],
    kind: "request",
    route: "DIRECT-IDENTIFIER",
  };
}

export function lookupWithEnvironment(
  env: CliEnvironment,
  args: LookupArgs,
): CliOutcome<unknown> {
  const attribute = String(args.attribute || "price").trim();
  const requestInput = createRequestInput(args.ticker, attribute);

  if (requestInput.classification === "fx" && requestInput.fxPair) {
    return resolveFxRequest(env, requestInput);
  }

  if (extractIsinFromRequestInput(requestInput)) {
    return resolveIsinRequest(env, requestInput);
  }

  return resolveDirectRequest(env, requestInput);
}

export function formatLookupResult(result: CliOutcome<unknown>): string {
  return JSON.stringify(
    {
      attemptedRoutes: result.attemptedRoutes,
      kind: result.kind,
      ok: result.status === "success",
      route: routeLabelFromLookup(result),
      value: result.status === "success" ? result.value : null,
    },
    null,
    2,
  );
}

export function formatRoutingTable(): string {
  return [
    ["classification", "example", "route"],
    ["equity", "GOOG", "DIRECT-IDENTIFIER"],
    ["fx", "USDUSD", "FX -> LOCAL"],
    ["fx", "EURUSD", "FX -> GOOGLE"],
    ["isin", "US02079K1079", "IDENTIFIER:ISIN -> YAHOO-ISIN"],
    ["isin", "PHY077751022", "IDENTIFIER:ISIN -> PSE-MAP"],
  ]
    .map((columns) => columns.join("\t"))
    .join("\n");
}

export function formatRoutingTree(): string {
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

export function runSmokeSuite(env = createCliEnvironment()): {
  failures: string[];
  passed: number;
  total: number;
} {
  const cases: CliSmokeCase[] = [
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        const resolved = result.value as { yahooSymbol?: string } | null;

        if (!resolved || resolved.yahooSymbol !== "GOOG") {
          throw new Error("expected GOOG to resolve directly");
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

        if (!result.value || (result.value as { regularMarketPrice?: number }).regularMarketPrice !== 1) {
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

        if (
          !result.value ||
          !Number.isFinite((result.value as { regularMarketPrice?: number }).regularMarketPrice)
        ) {
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

        const resolved = result.value as { yahooSymbol?: string } | null;

        if (resolved?.yahooSymbol !== "GOOG") {
          throw new Error("expected Yahoo ISIN lookup to resolve to GOOG");
        }
      },
      ticker: "US02079K1079",
    },
  ];
  const failures: string[] = [];

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

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npm run hoodlefinance.ts -- <ticker> [attribute]",
      "  npm run hoodlefinance.ts -- --trace <ticker> [attribute]",
      "  npm run hoodlefinance.ts -- --routing-table",
      "  npm run hoodlefinance.ts -- --routing-tree",
      "  npm run hoodlefinance.ts -- --smoke",
      "  npm run smoke.ts -- --smoke",
    ].join("\n"),
  );
}

function printTrace(result: CliOutcome<unknown>, ticker: string, attribute: string): void {
  console.log(`ticker: ${ticker}`);
  console.log(`attribute: ${attribute}`);
  console.log(`planned route: ${routeLabelFromLookup(result)}`);
  console.log(`attempted routes: ${result.attemptedRoutes.join(" -> ")}`);
  console.log(`result: ${result.status}`);
  if (result.status === "success") {
    console.log(JSON.stringify(result.value, null, 2));
    return;
  }

  console.log(result.error);
}

export function main(argv = process.argv.slice(2)): void {
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

  if (firstArg === "--routing-tree" || firstArg === "routing-tree") {
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
    printTrace(result, secondArg, thirdArg || "price");

    if (result.status !== "success") {
      process.exit(1);
    }

    return;
  }

  const result = lookupWithEnvironment(env, {
    attribute: secondArg || "price",
    ticker: firstArg,
  });
  console.log(formatLookupResult(result));

  if (result.status !== "success") {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createCliEnvironment,
  formatLookupResult,
  formatRoutingTable,
  formatRoutingTree,
  lookupWithEnvironment,
  main,
  runSmokeSuite,
};
