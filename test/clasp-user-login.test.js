/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  getClaspLoginContext,
  isExpectedCliError,
  parseArgs,
} = require("../tools/clasp-user-login.js");

test("parseArgs requires exactly one explicit clasp auth slot", function () {
  assert.deepEqual(parseArgs(["--addon-staging"]), {
    credsPath: "",
    noLocalhost: false,
    slotKey: "addon-staging",
  });

  assert.deepEqual(parseArgs(["--demo-production", "--no-localhost"]), {
    credsPath: "",
    noLocalhost: true,
    slotKey: "demo-production",
  });

  assert.throws(function () {
    parseArgs([]);
  }, /Choose a clasp auth slot to log into/);

  assert.throws(function () {
    parseArgs(["--demo-staging", "--addon-staging"]);
  }, /Choose exactly one clasp auth slot to log into/);
});

test("getClaspLoginContext resolves slot-local auth and oauth client paths", function () {
  const rootDir = "/tmp/hoodlefinance";
  const context = getClaspLoginContext(
    { slotKey: "addon-staging" },
    { rootDir: rootDir },
  );

  assert.equal(
    context.authPath,
    path.join(rootDir, ".addon-deploy.local", "staging", ".clasprc.json"),
  );
  assert.equal(
    context.credsPath,
    path.join(rootDir, ".addon-deploy.local", "staging", "oauth-client.json"),
  );
  assert.equal(context.flag, "--addon-staging");
  assert.equal(context.label, "add-on staging");
});

test("isExpectedCliError recognizes user-fixable login setup errors", function () {
  assert.equal(
    isExpectedCliError(new Error("Choose a clasp auth slot to log into: ...")),
    true,
  );
  assert.equal(
    isExpectedCliError(
      new Error("OAuth client JSON not found at /tmp/oauth-client.json."),
    ),
    true,
  );
  assert.equal(isExpectedCliError(new Error("unexpected failure")), false);
});
