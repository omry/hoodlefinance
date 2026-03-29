/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertMatchingCredentialIdentities,
  extractIdentityEmail,
} = require("../tools/demo/validate-credentials.js");

test("extractIdentityEmail normalizes email identities", function () {
  assert.equal(
    extractIdentityEmail("User.Name+demo@example.com.", "OAuth token"),
    "user.name+demo@example.com",
  );
});

test("assertMatchingCredentialIdentities accepts matching accounts", function () {
  assert.deepEqual(
    assertMatchingCredentialIdentities(
      "Omry@Example.com",
      "Authorized as omry@example.com",
    ),
    {
      claspEmail: "omry@example.com",
      tokenEmail: "omry@example.com",
    },
  );
});

test("assertMatchingCredentialIdentities rejects mismatched accounts", function () {
  assert.throws(function () {
    assertMatchingCredentialIdentities(
      "omry@example.com",
      "someone-else@example.com",
    );
  }, /does not match clasp identity/);
});

test("assertMatchingCredentialIdentities rejects missing identity details", function () {
  assert.throws(function () {
    assertMatchingCredentialIdentities(
      "omry@example.com",
      "(Logged in, no user details returned)",
    );
  }, /Unable to determine clasp email identity/);
});
