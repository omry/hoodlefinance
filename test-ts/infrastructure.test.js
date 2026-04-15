const assert = require("node:assert/strict");
const test = require("node:test");

// Current TS core index doesn't export any infrastructure/versioning helpers yet
const Core = require("../dist/ts/core/index.js");

// --- RECORDED GAPS (EXPECTED TO FAIL) ---

test.todo("GAP: HOODLEFINANCE_VERSION exists and follows semver");

test.todo("GAP: compareVersions utility parity");

test.todo("GAP: timestamp freshness utility parity");
