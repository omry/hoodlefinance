const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  compareResults,
  formatFailure,
  formatTraceDetails,
  getNewestSourceMtimeMs,
  isDateLike,
  normalizeComparableValue,
  parseArgs,
  parseCaseSpec,
} = require("../tools/compare-runtime-modes.js");

test("parseCaseSpec accepts explicit ticker and attribute", () => {
  assert.deepEqual(parseCaseSpec("GOOG::price"), {
    attribute: "price",
    ticker: "GOOG",
  });
});

test("parseCaseSpec defaults attribute to price", () => {
  assert.deepEqual(parseCaseSpec("GOOG"), {
    attribute: "price",
    ticker: "GOOG",
  });
});

test("parseArgs loads repeatable cases", () => {
  const options = parseArgs([
    "--mode",
    "js-ts",
    "--case",
    "GOOG::price",
    "--case",
    "USDUSD::price",
  ]);

  assert.equal(options.mode, "js-ts");
  assert.deepEqual(options.cases, [
    { attribute: "price", ticker: "GOOG" },
    { attribute: "price", ticker: "USDUSD" },
  ]);
});

test("parseArgs accepts positional mode shorthand", () => {
  const options = parseArgs([
    "js-ts",
    "--case",
    "USDUSD::price",
  ]);

  assert.equal(options.mode, "js-ts");
  assert.deepEqual(options.cases, [
    { attribute: "price", ticker: "USDUSD" },
  ]);
});

test("parseArgs accepts ts-fe mode", () => {
  const options = parseArgs([
    "--mode",
    "ts-fe",
    "--case",
    "GOOG::price",
  ]);

  assert.equal(options.mode, "ts-fe");
  assert.deepEqual(options.cases, [
    { attribute: "price", ticker: "GOOG" },
  ]);
});

test("parseArgs accepts js-fe positional shorthand", () => {
  const options = parseArgs([
    "js-fe",
    "--case",
    "GOOG::price",
  ]);

  assert.equal(options.mode, "js-fe");
  assert.deepEqual(options.cases, [
    { attribute: "price", ticker: "GOOG" },
  ]);
});

test("parseArgs loads cases from file", () => {
  const filePath = path.join(
    os.tmpdir(),
    `hoodlefinance-compare-cases-${Date.now()}.txt`,
  );
  fs.writeFileSync(filePath, "GOOG,price\nUSDUSD\tprice\n");

  try {
    const options = parseArgs([
      "--mode",
      "js-ts",
      "--cases-file",
      filePath,
    ]);

    assert.deepEqual(options.cases, [
      { attribute: "price", ticker: "GOOG" },
      { attribute: "price", ticker: "USDUSD" },
    ]);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test("normalizeComparableValue sorts object keys", () => {
  assert.equal(
    normalizeComparableValue({ b: 2, a: 1 }),
    normalizeComparableValue({ a: 1, b: 2 }),
  );
});

test("normalizeComparableValue handles cross-realm Date objects", () => {
  const sandboxDate = vm.runInNewContext('new Date("2026-01-02T03:04:05.000Z")');

  assert.equal(isDateLike(sandboxDate), true);
  assert.equal(
    normalizeComparableValue(sandboxDate),
    "2026-01-02T03:04:05.000Z",
  );
});

test("compareResults matches equal normalized outputs", () => {
  assert.deepEqual(
    compareResults(
      { error: "", status: "success", value: { b: 2, a: 1 } },
      { error: "", status: "success", value: { a: 1, b: 2 } },
    ),
    {
      errorMatch: true,
      statusMatch: true,
      valueMatch: true,
    },
  );
});

test("formatFailure prints a readable mismatch summary", () => {
  const output = formatFailure({
    attribute: "price",
    left: { error: "", status: "success", value: 1 },
    leftMode: "js",
    leftTrace: {
      plannedRoute: "QUOTE:TICKER",
      runtimeTrace: [{ label: "QUOTE:TICKER", status: "attempted" }],
    },
    reasons: ["value"],
    right: { error: "", status: "success", value: 2 },
    rightMode: "ts",
    rightTrace: {
      plannedRoute: "QUOTE:PSE",
      runtimeTrace: [{ label: "QUOTE:PSE", status: "attempted" }],
    },
    ticker: "USDUSD",
  });

  assert.match(output, /^FAIL USDUSD price$/m);
  assert.match(output, /mismatch: value/);
  assert.match(output, /js: status=success value=1 error=/);
  assert.match(output, /ts: status=success value=2 error=/);
  assert.match(output, /js trace: planned=QUOTE:TICKER; runtime=QUOTE:TICKER \[attempted\]/);
  assert.match(output, /ts trace: planned=QUOTE:PSE; runtime=QUOTE:PSE \[attempted\]/);
});

test("formatTraceDetails formats runtime entries with elapsed timing", () => {
  assert.equal(
    formatTraceDetails({
      plannedRoute: "DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE",
      runtimeTrace: [
        { elapsedMs: 12, label: "PSE-FRAMES", status: "success" },
        { elapsedMs: 4, label: "PSE-EDGE", status: "failure" },
      ],
    }),
    "planned=DEFAULT-ATTRIBUTE:EQUITY -> QUOTE:PSE; runtime=PSE-FRAMES [success, 12ms] -> PSE-EDGE [failure, 4ms]",
  );
});

test("getNewestSourceMtimeMs sees newer source files in src", () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hoodlefinance-compare-runtime-"),
  );
  const srcDir = path.join(rootDir, "src", "core");
  fs.mkdirSync(srcDir, { recursive: true });

  const tsconfigBuildPath = path.join(rootDir, "tsconfig.build.json");
  const tsconfigPath = path.join(rootDir, "tsconfig.json");
  const sourcePath = path.join(srcDir, "sample.ts");

  fs.writeFileSync(tsconfigBuildPath, "{}");
  fs.writeFileSync(tsconfigPath, "{}");
  fs.writeFileSync(sourcePath, "export const value = 1;\n");

  const olderTime = new Date("2026-04-08T10:00:00.000Z");
  const newerTime = new Date("2026-04-08T12:00:00.000Z");
  fs.utimesSync(tsconfigBuildPath, olderTime, olderTime);
  fs.utimesSync(tsconfigPath, olderTime, olderTime);
  fs.utimesSync(sourcePath, newerTime, newerTime);

  try {
    assert.equal(getNewestSourceMtimeMs(rootDir), fs.statSync(sourcePath).mtimeMs);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});
