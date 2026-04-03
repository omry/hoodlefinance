#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");

const ROOT_DIR = path.resolve(__dirname, "..");
const TRACKED_MANIFEST_PATH = path.join(
  ROOT_DIR,
  "docs",
  "google-sheets-editor-addon",
  "appsscript.json",
);
const ENTRY_PATH = path.join(
  ROOT_DIR,
  "src",
  "appscript",
  "install-global-bindings.ts",
);
const resolveRepoDataPlugin = {
  name: "resolve-repo-data",
  setup(build) {
    build.onResolve(
      { filter: /^\.\.\/\.\.\/\.\.\/data\/currency-codes\.json$/ },
      () => ({
        namespace: "appscript-runtime-data",
        path: "currency-codes.json",
      }),
    );
    build.onLoad(
      { filter: /^currency-codes\.json$/, namespace: "appscript-runtime-data" },
      () => ({
        contents: JSON.stringify({
          aliases: {},
          canonicalCodes: [],
          cryptoCodes: [],
        }),
        loader: "json",
      }),
    );
  },
};

function formatByteCount(byteCount) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, Number(byteCount) || 0);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPercentChange(beforeBytes, afterBytes) {
  if (!beforeBytes) {
    return "n/a";
  }

  const percentChange = ((afterBytes - beforeBytes) / beforeBytes) * 100;
  const sign = percentChange > 0 ? "+" : "";
  return `${sign}${percentChange.toFixed(1)}%`;
}

async function readFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return 0;
    }

    throw error;
  }
}

function parseArgs(argv) {
  const options = {
    minify: false,
  };

  for (const arg of argv) {
    if (arg === "--minify") {
      options.minify = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const trackedManifest = JSON.parse(
    await fs.readFile(TRACKED_MANIFEST_PATH, "utf8"),
  );
  const outDir = path.join(
    ROOT_DIR,
    "dist",
    options.minify ? "appscript-min" : "appscript",
  );
  const outfile = path.join(outDir, "hoodlefinance-ts.js");
  const manifestPath = path.join(outDir, "appsscript.json");
  const beforeBytes = await readFileSize(outfile);

  await fs.mkdir(outDir, { recursive: true });
  await esbuild.build({
    banner: {
      js: "/* SPDX-License-Identifier: MPL-2.0 */",
    },
    bundle: true,
    entryPoints: [ENTRY_PATH],
    format: "iife",
    legalComments: "none",
    loader: {
      ".json": "json",
    },
    outfile,
    platform: "neutral",
    plugins: [resolveRepoDataPlugin],
    minify: options.minify,
    target: ["es2020"],
  });
  const afterBytes = await readFileSize(outfile);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(trackedManifest, null, 2) + "\n",
  );
  process.stdout.write(`Built ${path.relative(ROOT_DIR, outfile)}\n`);
  process.stdout.write(
    `Bundle size: ${formatByteCount(beforeBytes)} -> ${formatByteCount(afterBytes)} (${formatPercentChange(beforeBytes, afterBytes)})\n`,
  );
  process.stdout.write(`Wrote ${path.relative(ROOT_DIR, manifestPath)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
