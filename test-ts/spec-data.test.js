const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PLAN_CAN_HANDLE_REFS,
  PLAN_ROUTE_STATE_BUILDER_REFS,
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

  assert.deepEqual(PLAN_ROUTE_STATE_BUILDER_REFS, {
    EQUITY_YAHOO_QUOTE: "EQUITY_YAHOO_QUOTE",
    FX_QUOTE: "FX_QUOTE",
    PSE_QUOTE: "PSE_QUOTE",
  });
  assert.deepEqual(PLAN_CAN_HANDLE_REFS, {
    CLASSIFICATION_EQUITY: "CLASSIFICATION_EQUITY",
    CLASSIFICATION_FX: "CLASSIFICATION_FX",
  });
});
