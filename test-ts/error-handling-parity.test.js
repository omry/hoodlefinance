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

test.todo("GAP: ISIN search ambiguity error messaging");

test.todo("GAP: Provider-specific not-found error parity");
