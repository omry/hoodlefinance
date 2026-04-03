#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENTRY_PATH = path.join(
  ROOT_DIR,
  "src",
  "appscript",
  "install-global-bindings.ts",
);
const CURRENCY_CODES_PATH = path.join(ROOT_DIR, "data", "currency-codes.json");
const MANIFEST = {
  exceptionLogging: "STACKDRIVER",
  oauthScopes: [
    "https://www.googleapis.com/auth/script.external_request",
  ],
  runtimeVersion: "V8",
  timeZone: "Etc/UTC",
  urlFetchWhitelist: [
    "https://raw.githubusercontent.com/omry/hoodlefinance/",
    "https://www.londonstockexchange.com/exchange/",
    "https://www.tradingview.com/symbols/",
    "https://edge.pse.com.ph/",
    "https://frames.pse.com.ph/",
    "https://www.google.com/finance/",
    "https://query1.finance.yahoo.com/v8/finance/",
    "https://query2.finance.yahoo.com/v1/finance/",
  ],
};
const resolveRepoDataPlugin = {
  name: "resolve-repo-data",
  setup(build) {
    build.onResolve(
      { filter: /^\.\.\/\.\.\/\.\.\/data\/currency-codes\.json$/ },
      () => ({
        path: CURRENCY_CODES_PATH,
      }),
    );
  },
};

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
  const outDir = path.join(
    ROOT_DIR,
    "dist",
    options.minify ? "appscript-min" : "appscript",
  );
  const outfile = path.join(outDir, "hoodlefinance-ts.js");
  const manifestPath = path.join(outDir, "appsscript.json");

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
  await fs.writeFile(manifestPath, JSON.stringify(MANIFEST, null, 2) + "\n");
  process.stdout.write(`Built ${path.relative(ROOT_DIR, outfile)}\n`);
  process.stdout.write(`Wrote ${path.relative(ROOT_DIR, manifestPath)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
