const assert = require("node:assert/strict");
const test = require("node:test");

// The TS core doesn't yet have a global cache/persistence manager.
// These tests record the expected behavior from the legacy runtime infrastructure.
const Core = require("../dist/ts/core/index.js");

test("GAP: Cache key versioning (parity with hf_versionCacheKey_)", () => {
  // Legacy prepends a version-based prefix to cache keys.
  // We expect a utility in the core to handle this normalization.
  assert.ok(typeof Core.versionCacheKey === "function", "versionCacheKey should be exported");
  assert.match(Core.versionCacheKey("my-key"), /^v\d+\.\d+\.\d+:my-key$/);
});

test("GAP: JSON cache serialization (parity with hf_putCachedJson_)", () => {
  // Legacy handles JSON serialization transparently in the cache layer.
  // Current TS dependencies are string-only.
  const myData = { foo: "bar" };
  const mockCache = {
    put: (key, val) => { this.val = val; }
  };
  
  // We expect a high-level cache manager in the core.
  assert.ok(typeof Core.CacheManager === "function", "CacheManager class should exist");
  const mgr = new Core.CacheManager(mockCache);
  mgr.putJson("test-key", myData);
  
  assert.equal(mockCache.val, JSON.stringify(myData));
});

test("GAP: Property store value chunking (parity with legacy property stores)", () => {
  // Legacy splits large strings (e.g. > 9KB) across multiple property keys.
  // We expect a persistence abstraction in the core that handles this logic.
  assert.ok(typeof Core.PersistenceManager === "function", "PersistenceManager class should exist");
  
  const largeString = "A".repeat(15000); // Exceeds typical property store limit
  const store = {};
  const mgr = new Core.PersistenceManager({
    setProperty: (k, v) => { store[k] = v; },
    getProperty: (k) => store[k]
  });
  
  mgr.setProperty("large-key", largeString);
  
  // We expect multiple keys in the store or a specific chunking indicator.
  assert.ok(Object.keys(store).length > 1, "Should have chunked the large value into multiple keys");
  assert.equal(mgr.getProperty("large-key"), largeString, "Should reassemble the chunked value correctly");
});
