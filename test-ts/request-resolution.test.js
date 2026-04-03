const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveRequestEnvelope,
} = require("../dist/ts/core/index.js");

function createEnv() {
  return {
    buildResolvePlan() {
      throw new Error("buildResolvePlan should not be called for deferred modes");
    },
    fetchText() {
      return "";
    },
    getCachedString() {
      return "";
    },
    looksLikeIsin() {
      return false;
    },
    putCachedString(_key, value) {
      return String(value || "");
    },
  };
}

function createRequestInput(overrides = {}) {
  return {
    attribute: "price",
    attributeType: "quote",
    identifier: "GOOG",
    infoMode: "",
    sourceOverride: "",
    ticker: "GOOG",
    ...overrides,
  };
}

test("resolveRequestEnvelope rejects deferred info modes before plan building", () => {
  const result = resolveRequestEnvelope(
    createEnv(),
    createRequestInput({ infoMode: "source-list" }),
  );

  assert.equal(result.status, "failure");
  assert.equal(result.route, "(none)");
  assert.match(
    result.error,
    /Ticker route introspection is not yet available\./,
  );
});

test("resolveRequestEnvelope rejects deferred source overrides before plan building", () => {
  const result = resolveRequestEnvelope(
    createEnv(),
    createRequestInput({ sourceOverride: "YAHOO" }),
  );

  assert.equal(result.status, "failure");
  assert.equal(result.route, "(none)");
  assert.match(result.error, /"@YAHOO" is not available for this request\./);
});
