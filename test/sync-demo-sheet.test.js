const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  CONFIG_PATH,
  buildSheetRange,
  loadDemoSheetConfig,
  parseArgs,
  parseTsv,
  renderDemoReadmeBlock,
  replaceDemoReadmeBlock,
  resolveRepoPath,
  validateConfig,
} = require("../tools/sync-demo-sheet.js");

test("parseArgs handles the supported flags", function () {
  assert.deepEqual(parseArgs([]), {
    dryRun: false,
    skipClasp: false,
    skipSharing: false,
  });
  assert.deepEqual(parseArgs(["--dry-run", "--skip-clasp", "--skip-sharing"]), {
    dryRun: true,
    skipClasp: true,
    skipSharing: true,
  });
  assert.throws(function () {
    parseArgs(["--wat"]);
  }, /Unknown argument/);
});

test("parseTsv preserves blank interior rows and strips only trailing newline rows", function () {
  assert.deepEqual(parseTsv("a\tb\n1\t2\n\n3\t4\n"), [
    ["a", "b"],
    ["1", "2"],
    [""],
    ["3", "4"],
  ]);
  assert.deepEqual(parseTsv(""), [[""]]);
});

test("buildSheetRange quotes sheet names for A1 notation", function () {
  assert.equal(buildSheetRange("Ticker Forms", "A1"), "'Ticker Forms'!A1");
  assert.equal(buildSheetRange("Bob's Tab", "A:ZZZ"), "'Bob''s Tab'!A:ZZZ");
});

test("demo README block renders a placeholder before the public sheet exists", function () {
  assert.match(renderDemoReadmeBlock(""), /will be linked here/);
  assert.match(renderDemoReadmeBlock("https://docs.google.com/spreadsheets/d/demo/edit"), /public demo sheet/);
});

test("replaceDemoReadmeBlock replaces an existing marker section", function () {
  const original = [
    "# Example",
    "",
    "<!-- DEMO_SHEET_LINK:START -->",
    "old text",
    "<!-- DEMO_SHEET_LINK:END -->",
    "",
    "## Quick Start",
  ].join("\n");
  const updated = replaceDemoReadmeBlock(original, "https://docs.google.com/spreadsheets/d/demo/edit");

  assert.doesNotMatch(updated, /old text/);
  assert.match(updated, /public demo sheet/);
});

test("the tracked demo-sheet config validates and its TSV paths exist", function () {
  const config = loadDemoSheetConfig(CONFIG_PATH);

  validateConfig(config);
  config.tabs.forEach(function (tab) {
    assert.equal(fs.existsSync(resolveRepoPath(tab.path)), true, tab.path);
  });
});
