const assert = require("node:assert/strict");
const test = require("node:test");

test("cli-ts wrapper re-exports the compiled TS CLI module", () => {
  const wrapper = require("../tools/_shared/cli-ts.js");
  const cli = require("../dist/ts/hoodlefinance.js");

  assert.strictEqual(wrapper, cli);
  assert.equal(typeof wrapper.main, "function");
  assert.equal(typeof wrapper.lookupWithEnvironment, "function");
  assert.equal(typeof wrapper.runSmokeSuite, "function");
});
