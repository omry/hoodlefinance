#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SPDX_ID = "MPL-2.0";
const TARGET_EXTENSIONS = new Set([".css", ".js", ".py", ".sh"]);
const IGNORED_DIR_NAMES = new Set([
  ".addon-deploy.local",
  ".demo-sheet.local",
  ".docusaurus",
  ".git",
  ".pytest_cache",
  ".cache-loader",
  "__pycache__",
  "build",
  "node_modules",
  "tmp",
]);
const COMMENT_BY_EXTENSION = {
  ".css": "/* SPDX-License-Identifier: " + SPDX_ID + " */",
  ".js": "/* SPDX-License-Identifier: " + SPDX_ID + " */",
  ".py": "# SPDX-License-Identifier: " + SPDX_ID,
  ".sh": "# SPDX-License-Identifier: " + SPDX_ID,
};

function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePaths = getSourceFiles(options.rootDir);
  const relativePaths = filePaths.map(function (filePath) {
    return path.relative(options.rootDir, filePath);
  });

  if (options.list) {
    for (let i = 0; i < relativePaths.length; i += 1) {
      process.stdout.write(relativePaths[i] + "\n");
    }
    return;
  }

  const missing = [];

  for (let i = 0; i < filePaths.length; i += 1) {
    const filePath = filePaths[i];
    const original = fs.readFileSync(filePath, "utf8");
    const updated = ensureSpdxHeader(filePath, original);

    if (updated === original) {
      continue;
    }

    if (options.check) {
      missing.push(path.relative(options.rootDir, filePath));
      continue;
    }

    fs.writeFileSync(filePath, updated);
  }

  if (options.check && missing.length) {
    process.stderr.write("Missing SPDX headers in:\n");
    for (let i = 0; i < missing.length; i += 1) {
      process.stderr.write("- " + missing[i] + "\n");
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    (options.check ? "Verified" : "Updated") +
      " SPDX headers for " +
      filePaths.length +
      " tracked source file" +
      (filePaths.length === 1 ? "" : "s") +
      ".\n",
  );
}

function parseArgs(argv) {
  const options = {
    check: false,
    list: false,
    rootDir: ROOT_DIR,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--list") {
      options.list = true;
      continue;
    }
    throw new Error("Usage: node tools/license/spdx-headers.js [--check|--list]");
  }

  if (options.check && options.list) {
    throw new Error("Usage: node tools/license/spdx-headers.js [--check|--list]");
  }

  return options;
}

function getSourceFiles(rootDir) {
  const results = [];
  walkDirectory(rootDir, results);
  return results;
}

function walkDirectory(directoryPath, results) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (IGNORED_DIR_NAMES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(absolutePath, results);
      continue;
    }

    if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(absolutePath);
    }
  }
}

function ensureSpdxHeader(filePath, source) {
  const extension = path.extname(filePath);
  const desiredHeader = COMMENT_BY_EXTENSION[extension];
  if (!desiredHeader) {
    return source;
  }

  const shebangMatch = source.match(/^(#![^\n]*\n)/);
  const shebang = shebangMatch ? shebangMatch[1] : "";
  const rest = shebang ? source.slice(shebang.length) : source;

  const lines = rest.split("\n");
  const firstLine = lines[0] || "";

  if (firstLine === desiredHeader) {
    return source;
  }

  if (/^(#|\/\*) SPDX-License-Identifier: /.test(firstLine)) {
    lines[0] = desiredHeader;
    return shebang + lines.join("\n");
  }

  return shebang + desiredHeader + "\n\n" + rest;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error && error.message ? error.message : error) + "\n");
    process.exitCode = 1;
  }
}

module.exports = {
  COMMENT_BY_EXTENSION,
  ROOT_DIR,
  SPDX_ID,
  TARGET_EXTENSIONS,
  ensureSpdxHeader,
  getSourceFiles,
  IGNORED_DIR_NAMES,
  parseArgs,
};
