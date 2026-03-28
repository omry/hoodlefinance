/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ensureSpdxHeader,
  parseArgs,
} = require("../tools/license/spdx-headers.js");

test("ensureSpdxHeader adds a JS SPDX header", function () {
  assert.equal(
    ensureSpdxHeader("example.js", "const value = 1;\n"),
    "/* SPDX-License-Identifier: MPL-2.0 */\n\nconst value = 1;\n",
  );
});

test("ensureSpdxHeader adds a shell SPDX header after the shebang", function () {
  assert.equal(
    ensureSpdxHeader("example.sh", "#!/bin/sh\n\necho hi\n"),
    "#!/bin/sh\n# SPDX-License-Identifier: MPL-2.0 */\n\n\necho hi\n".replace(
      "# SPDX-License-Identifier: MPL-2.0 */",
      "# SPDX-License-Identifier: MPL-2.0",
    ),
  );
});

test("ensureSpdxHeader leaves matching headers unchanged", function () {
  const source = "/* SPDX-License-Identifier: MPL-2.0 */\n\nconst value = 1;\n";
  assert.equal(ensureSpdxHeader("example.js", source), source);
});

test("ensureSpdxHeader replaces an existing SPDX header with the expected comment style", function () {
  assert.equal(
    ensureSpdxHeader(
      "example.py",
      "/* SPDX-License-Identifier: MIT */\n\nprint('hi')\n",
    ),
    "# SPDX-License-Identifier: MPL-2.0\n\nprint('hi')\n",
  );
});

test("parseArgs supports list mode", function () {
  assert.deepEqual(parseArgs(["--list"]), {
    check: false,
    list: true,
    rootDir: parseArgs([]).rootDir,
  });
});

test("parseArgs rejects combining check and list", function () {
  assert.throws(function () {
    parseArgs(["--check", "--list"]);
  }, /Usage: node tools\/license\/spdx-headers\.js \[--check\|--list\]/);
});
