const assert = require("node:assert/strict");
const test = require("node:test");

test("cli-ts wrapper exposes the CLI entrypoints", () => {
  const cli = require("../tools/_shared/cli-ts.js");

  assert.equal(typeof cli.createCliEnvironment, "function");
  assert.equal(typeof cli.formatEnvelopeResult, "function");
  assert.equal(typeof cli.formatLookupResult, "function");
  assert.equal(typeof cli.main, "function");
  assert.equal(typeof cli.lookupEnvelopeWithEnvironment, "function");
  assert.equal(typeof cli.lookupWithEnvironment, "function");
  assert.equal(typeof cli.runSmokeSuite, "function");
});
