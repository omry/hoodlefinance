const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core handles basic errors, but missing full parity with hf_buildYahooQuoteLookupErrorMessage_
// and specific delisted/OTCMKTS messaging.
const Core = require("../dist/ts/core/index.js");

test("GAP: OTCMKTS specific 404 error messaging", () => {
  // Legacy hf_buildYahooQuoteLookupErrorMessage_ (line 21 in yahoo-quote.ts) handles OTCMKTS:.
  // We expect a general utility in the core for this.
  const message = Core.buildYahooQuoteLookupErrorMessage("OTCMKTS:AAPL", 404);
  assert.equal(
    message,
    "No current quote data was found for OTCMKTS:AAPL. The symbol may be delisted or cancelled."
  );
});

test("GAP: ISIN search ambiguity error messaging", () => {
  // Legacy hf_extractExactPseListingMatch_ (in PSE search logic) throws specific errors.
  // We expect standard error messages for "multiple matches found" or "no matches found".
  assert.ok(typeof Core.buildAmbiguityErrorMessage === "function", "buildAmbiguityErrorMessage should be exported");
  
  const message = Core.buildAmbiguityErrorMessage("AAPL", ["NASDAQ:AAPL", "NYSE:AAPL"]);
  assert.equal(
    message,
    "Multiple matches for \"AAPL\" were found. Please use a more specific identifier."
  );
});

test("GAP: Provider-specific not-found error parity", () => {
  // Legacy hf_resolvePseFramesQuote_ (and others) throw specific errors.
  // We expect standard error messaging for provider misses.
  const message = Core.buildProviderNotFoundError("PSE", "AAPL");
  assert.equal(
    message,
    "No PSE listing was found for \"AAPL\"."
  );
});
