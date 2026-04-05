const assert = require("node:assert/strict");
const test = require("node:test");

// Current TS core index doesn't export any infrastructure/versioning helpers yet
const Core = require("../dist/ts/core/index.js");

// --- RECORDED GAPS (EXPECTED TO FAIL) ---

test("GAP: HOODLEFINANCE_VERSION exists and follows semver", () => {
  assert.ok(Core.HOODLEFINANCE_VERSION, "Version constant should be exported");
  assert.match(Core.HOODLEFINANCE_VERSION, /^\d+\.\d+\.\d+$/);
});

test("GAP: compareVersions utility parity", () => {
  // We expect a helper function that can compare version strings
  assert.ok(typeof Core.compareVersions === "function", "compareVersions should be exported");
  assert.equal(Core.compareVersions("1.2.3", "1.2.2"), 1);
  assert.equal(Core.compareVersions("1.2.3", "1.3.0"), -1);
  assert.equal(Core.compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(Core.compareVersions("1.10.1", "1.9.5"), 1);
});

test("GAP: timestamp freshness utility parity", () => {
  // We expect a helper that checks if a timestamp is within a TTL window
  assert.ok(typeof Core.isTimestampFresh === "function", "isTimestampFresh should be exported");
  
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const twoDaysAgo = now - (48 * 60 * 60 * 1000);
  
  assert.equal(Core.isTimestampFresh(oneHourAgo, 24), true);
  assert.equal(Core.isTimestampFresh(twoDaysAgo, 24), false);
});
