const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PLAN_SPECS_BY_CODE,
  RESOLVER_SPECS_BY_CODE,
} = require("../dist/ts/core/index.js");

test("extracted routing spec data matches the current production tables", () => {
  assert.equal(
    RESOLVER_SPECS_BY_CODE["RESOLVED-IDENTIFIER"],
    "DirectIdentifierResolver",
  );
  assert.equal(
    PLAN_SPECS_BY_CODE["QUOTE:PSE"].resolverClass,
    "PseQuoteResolutionPlan",
  );
  assert.equal(PLAN_SPECS_BY_CODE["ROOT"].resolverClass, "ResolverPlan");
});
