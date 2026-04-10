#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const fs = require("node:fs");
const path = require("node:path");

const LegacyCli = require("./_shared/cli.js");
const TsCli = require("./_shared/cli-ts.js");

const ROOT_DIR = path.resolve(__dirname, "..");

const DEFAULT_CASES = [
  // Direct equity quote routing
  { attribute: "price", ticker: "GOOG" },
  { attribute: "isin", ticker: "GOOG" },
  { attribute: "name", ticker: "IBM" },

  // Exchange-qualified equity routing
  { attribute: "price", ticker: "PSE:BDO" },
  { attribute: "price", ticker: "TLV:KSMF59" },

  // FX routing
  { attribute: "price", ticker: "EURUSD" },
  { attribute: "price", ticker: "USDUSD" },

  // ISIN-driven identifier routing
  { attribute: "price", ticker: "US02079K1079" },
  { attribute: "price", ticker: "PHY077751022" },
  { attribute: "price", ticker: "ISIN:US02079K1079" },
  { attribute: "price", ticker: "ISIN:PHY077751022" },

  // Preferred and suffix normalization cases
  { attribute: "price", ticker: "NLY-I" },
  { attribute: "symbol:yahoo", ticker: "NLY-I" },
];

function isDateLike(value) {
  return (
    Object.prototype.toString.call(value) === "[object Date]" &&
    typeof value.toISOString === "function"
  );
}

function printUsage(exitCode, error) {
  if (error) {
    console.error(error);
  }

  console.error(
    "Usage: npm run compare:modes -- --mode <js-ts> [--case <ticker>::<attribute>]... [--cases-file <path>]",
  );
  console.error(
    "   or: npm run compare:modes <js-ts>",
  );
  console.error(
    "Example: npm run compare:modes -- --mode js-ts --case GOOG::price --case US02079K1079::price",
  );
  console.error(
    "Short form (mode only): npm run compare:modes js-ts",
  );
  console.error(
    "Use -- before extra flags, for example: npm run compare:modes -- --mode js-ts --case USDUSD::price",
  );
  console.error(
    "Cases file format: one case per line as <ticker>,<attribute> or <ticker>\\t<attribute>",
  );
  process.exit(exitCode);
}

function parseCaseSpec(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("Case spec cannot be empty.");
  }

  const separatorIndex = text.indexOf("::");
  if (separatorIndex < 0) {
    return {
      attribute: "price",
      ticker: text,
    };
  }

  const ticker = text.slice(0, separatorIndex).trim();
  const attribute = text.slice(separatorIndex + 2).trim() || "price";

  if (!ticker) {
    throw new Error(`Invalid case spec "${text}".`);
  }

  return { attribute, ticker };
}

function parseCaseFileLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const tabParts = trimmed.split("\t");
  if (tabParts.length >= 2) {
    return {
      attribute: String(tabParts[1] || "").trim() || "price",
      ticker: String(tabParts[0] || "").trim(),
    };
  }

  const commaParts = trimmed.split(",");
  if (commaParts.length >= 2) {
    return {
      attribute: String(commaParts[1] || "").trim() || "price",
      ticker: String(commaParts[0] || "").trim(),
    };
  }

  return parseCaseSpec(trimmed);
}

function loadCasesFromFile(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), "utf8");
  const cases = [];

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseCaseFileLine(line);
    if (parsed) {
      if (!parsed.ticker) {
        throw new Error(`Invalid case line: ${JSON.stringify(line)}`);
      }
      cases.push(parsed);
    }
  }

  return cases;
}

function parseArgs(argv) {
  const options = {
    cases: [],
    mode: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--mode" && argv[i + 1]) {
      options.mode = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (arg === "--case" && argv[i + 1]) {
      options.cases.push(parseCaseSpec(argv[i + 1]));
      i += 1;
      continue;
    }

    if (arg === "--cases-file" && argv[i + 1]) {
      options.cases.push(...loadCasesFromFile(argv[i + 1]));
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage(0);
    }

    if (!options.mode && arg === "js-ts") {
      options.mode = arg;
      continue;
    }

    printUsage(1, `Unknown argument: ${arg}`);
  }

  if (options.mode !== "js-ts") {
    printUsage(1, "--mode must be: js-ts");
  }

  if (!options.cases.length) {
    options.cases = DEFAULT_CASES.slice();
  }

  return options;
}

function ensureTsBuild() {
  const requiredPaths = [
    path.join(ROOT_DIR, "dist", "ts", "runtime", "host-adapter.js"),
    path.join(ROOT_DIR, "dist", "ts", "core", "index.js"),
  ];
  const newestSourceMtimeMs = getNewestSourceMtimeMs(ROOT_DIR);

  for (const requiredPath of requiredPaths) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(
        'TypeScript build artifacts are missing. Run "npm run compare:modes -- --mode ..." or "npm run build:ts" first.',
      );
    }

    if (fs.statSync(requiredPath).mtimeMs < newestSourceMtimeMs) {
      throw new Error(
        'TypeScript build artifacts are stale. Run "npm run compare:modes -- --mode ..." or "npm run build:ts" first.',
      );
    }
  }
}

function getNewestMtimeMsInTree(rootPath, predicate) {
  let newestMtimeMs = 0;

  function visit(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!predicate(entryPath, entry)) {
        continue;
      }

      newestMtimeMs = Math.max(newestMtimeMs, fs.statSync(entryPath).mtimeMs);
    }
  }

  visit(rootPath);
  return newestMtimeMs;
}

function getNewestSourceMtimeMs(projectRoot) {
  const sourceFiles = [
    path.join(projectRoot, "tsconfig.build.json"),
    path.join(projectRoot, "tsconfig.json"),
  ];
  let newestMtimeMs = 0;

  for (const sourceFile of sourceFiles) {
    if (fs.existsSync(sourceFile)) {
      newestMtimeMs = Math.max(newestMtimeMs, fs.statSync(sourceFile).mtimeMs);
    }
  }

  const srcRoot = path.join(projectRoot, "src");
  if (fs.existsSync(srcRoot)) {
    newestMtimeMs = Math.max(
      newestMtimeMs,
      getNewestMtimeMsInTree(srcRoot, (entryPath) => entryPath.endsWith(".ts")),
    );
  }

  return newestMtimeMs;
}

function stableNormalize(value) {
  if (isDateLike(value)) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = stableNormalize(value[key]);
    }
    return output;
  }

  return value;
}

function normalizeComparableValue(value) {
  if (value == null) {
    return null;
  }

  if (isDateLike(value)) {
    return value.toISOString();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(stableNormalize(value));
}

function runLookup(mode, lookupCase) {
  if (mode === "js") {
    const result = LegacyCli.runLookup(lookupCase.ticker, lookupCase.attribute);
    return {
      error: result.ok ? "" : String(result.error || ""),
      status: result.ok ? "success" : "failure",
      value: result.value,
    };
  }

  if (mode === "ts") {
    const env = TsCli.createCliEnvironment();
    return TsCli.resolveAttributeResultWithEnvironment(env, lookupCase);
  }

  throw new Error(`Unsupported lookup mode "${mode}".`);
}

function collectTrace(mode, lookupCase) {
  if (mode === "js") {
    const trace = LegacyCli.traceRoutingForSymbol(
      lookupCase.ticker,
      lookupCase.attribute,
    );

    return {
      plannedRoute: String(trace.plannedRoute || "(none)"),
      runtimeTrace: Array.isArray(trace.runtimeTrace)
        ? trace.runtimeTrace.map((entry) => ({
            elapsedMs:
              entry && entry.elapsedMs != null
                ? Number(entry.elapsedMs)
                : null,
            label: String((entry && entry.label) || ""),
            status: String((entry && entry.status) || ""),
          }))
        : [],
    };
  }

  return {
    plannedRoute:
      "(unavailable: TypeScript runtime tracing is not implemented)",
    runtimeTrace: [
      {
        elapsedMs: null,
        label: "TypeScript runtime trace unavailable",
        status: "unavailable",
      },
    ],
  };
}

function compareResults(left, right) {
  return {
    errorMatch: String(left.error || "") === String(right.error || ""),
    statusMatch: String(left.status || "") === String(right.status || ""),
    valueMatch:
      normalizeComparableValue(left.value) ===
      normalizeComparableValue(right.value),
  };
}

function summarizeFailure(lookupCase, leftMode, left, rightMode, right, parity) {
  const reasons = [];
  if (!parity.statusMatch) reasons.push("status");
  if (!parity.valueMatch) reasons.push("value");
  if (!parity.errorMatch) reasons.push("error");

  return {
    attribute: lookupCase.attribute,
    left,
    leftMode,
    reasons,
    right,
    rightMode,
    ticker: lookupCase.ticker,
  };
}

function formatFailure(failure) {
  const leftTrace = formatTraceDetails(failure.leftTrace);
  const rightTrace = formatTraceDetails(failure.rightTrace);
  return [
    `FAIL ${failure.ticker} ${failure.attribute}`,
    `  mismatch: ${failure.reasons.join(", ")}`,
    `  ${failure.leftMode}: status=${failure.left.status} value=${normalizeComparableValue(failure.left.value)} error=${String(failure.left.error || "")}`,
    `  ${failure.rightMode}: status=${failure.right.status} value=${normalizeComparableValue(failure.right.value)} error=${String(failure.right.error || "")}`,
    `  ${failure.leftMode} trace: ${leftTrace}`,
    `  ${failure.rightMode} trace: ${rightTrace}`,
  ].join("\n");
}

function formatTraceDetails(trace) {
  if (!trace) {
    return "(unavailable)";
  }

  const plannedRoute = String(trace.plannedRoute || "(none)");
  const runtimeTrace = Array.isArray(trace.runtimeTrace)
    ? trace.runtimeTrace
    : [];

  if (!runtimeTrace.length) {
    return `planned=${plannedRoute}; runtime=(none)`;
  }

  return `planned=${plannedRoute}; runtime=${runtimeTrace
    .map((entry) => {
      const parts = [String((entry && entry.label) || "")];
      const status = String((entry && entry.status) || "");
      const elapsedMs =
        entry && entry.elapsedMs != null ? Number(entry.elapsedMs) : null;

      if (status) {
        parts.push(`[${status}${elapsedMs != null ? `, ${elapsedMs}ms` : ""}]`);
      } else if (elapsedMs != null) {
        parts.push(`[${elapsedMs}ms]`);
      }

      return parts.join(" ");
    })
    .join(" -> ")}`;
}

function formatCaseResult(lookupCase, parity) {
  const status = parity.statusMatch && parity.valueMatch && parity.errorMatch
    ? "PASS"
    : "FAIL";
  return `${status} ${lookupCase.ticker} ${lookupCase.attribute}`;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  ensureTsBuild();

  const [leftMode, rightMode] = ["js", "ts"];
  const failures = [];

  for (const lookupCase of options.cases) {
    const left = runLookup(leftMode, lookupCase);
    const right = runLookup(rightMode, lookupCase);
    const parity = compareResults(left, right);

    console.log(formatCaseResult(lookupCase, parity));

    if (!parity.statusMatch || !parity.valueMatch || !parity.errorMatch) {
      failures.push(
        Object.assign(
          summarizeFailure(lookupCase, leftMode, left, rightMode, right, parity),
          {
            leftTrace: collectTrace(leftMode, lookupCase),
            rightTrace: collectTrace(rightMode, lookupCase),
          },
        ),
      );
    }
  }

  console.log(`mode: ${options.mode}`);
  console.log(`cases: ${options.cases.length}`);
  console.log(`passed: ${options.cases.length - failures.length}`);
  console.log(`failed: ${failures.length}`);

  if (!failures.length) {
    return;
  }

  for (const failure of failures) {
    console.log("");
    console.log(formatFailure(failure));
  }

  process.exit(1);
}

module.exports = {
  compareResults,
  DEFAULT_CASES,
  formatFailure,
  formatTraceDetails,
  getNewestSourceMtimeMs,
  isDateLike,
  loadCasesFromFile,
  normalizeComparableValue,
  parseArgs,
  parseCaseSpec,
};

if (require.main === module) {
  main();
}
