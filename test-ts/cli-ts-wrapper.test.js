const assert = require("node:assert/strict");
const test = require("node:test");

test("cli-ts wrapper exposes the CLI entrypoints", () => {
  const cli = require("../tools/_shared/cli-ts.js");

  assert.equal(typeof cli.createBrowserOpenCommand, "function");
  assert.equal(typeof cli.createCliEnvironment, "function");
  assert.equal(typeof cli.createGraphSvgHtmlDocument, "function");
  assert.equal(typeof cli.handleGraphCommand, "function");
  assert.equal(typeof cli.main, "function");
  assert.equal(typeof cli.parseGraphCommandOptions, "function");
  assert.equal(typeof cli.resolveAttributeResultWithEnvironment, "function");
  assert.equal(typeof cli.resolveAttributeTraceWithEnvironment, "function");
  assert.equal(typeof cli.renderGraphMermaidWithEnvironment, "function");
  assert.equal(typeof cli.renderGraphSvgWithEnvironment, "function");
  assert.equal(typeof cli.renderGraphTextWithEnvironment, "function");
  assert.equal(typeof cli.renderMermaidAsTextGraph, "function");
  assert.equal(typeof cli.writeGraphBrowserHtmlFile, "function");
  assert.equal(typeof cli.openFileInBrowser, "function");
  assert.equal(typeof cli.openFileInBrowserWithSpawn, "function");
  assert.equal(typeof cli.runSmokeSuite, "function");
});
