const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core doesn't yet have a global cache/persistence manager.
// These tests record the expected behavior from the legacy runtime infrastructure.
const Core = require("../dist/ts/core/index.js");

test.todo("GAP: Cache key versioning (parity with hf_versionCacheKey_)");

test.todo("GAP: JSON cache serialization (parity with hf_putCachedJson_)");

test.todo(
  "GAP: Property store value chunking (parity with legacy property stores)",
);
