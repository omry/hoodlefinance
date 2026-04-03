#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT_DIR, "hoodlefinance.js");
const OUT_DIR = path.join(ROOT_DIR, "dist", "appscript-legacy-min");
const OUTFILE = path.join(OUT_DIR, "hoodlefinance.min.js");
const SPDX_BANNER = "/* SPDX-License-Identifier: MPL-2.0 */\n";

async function main() {
  const source = await fs.readFile(SOURCE_PATH, "utf8");
  const result = await esbuild.transform(source, {
    legalComments: "none",
    loader: "js",
    minify: true,
    target: ["es2020"],
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUTFILE, SPDX_BANNER + result.code, "utf8");

  process.stdout.write(`Built ${path.relative(ROOT_DIR, OUTFILE)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
