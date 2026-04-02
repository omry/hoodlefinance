#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DEFAULT_OUTPUT_PATH = path.join(ROOT_DIR, ".act", "secrets");
const USAGE = "Usage: node tools/act/create-secrets.js [--output <path>]";
const SECRET_SOURCES = [
  {
    key: "CLASP_RC_JSON",
    sourcePath: path.join(ROOT_DIR, ".clasp.local", ".clasprc.json"),
  },
  {
    key: "ADDON_DEPLOY_CLASP_RC_JSON",
    sourcePath: path.join(
      ROOT_DIR,
      ".addon-deploy.local",
      "production",
      ".clasprc.json",
    ),
  },
  {
    key: "DEMO_SHEET_CLASP_RC_JSON",
    sourcePath: path.join(
      ROOT_DIR,
      ".demo-sheet.local",
      "production",
      ".clasprc.json",
    ),
  },
  {
    key: "DEMO_SHEET_OAUTH_CLIENT_JSON",
    sourcePath: path.join(
      ROOT_DIR,
      ".demo-sheet.local",
      "production",
      "oauth-client.json",
    ),
  },
  {
    key: "DEMO_SHEET_OAUTH_TOKEN_JSON",
    sourcePath: path.join(
      ROOT_DIR,
      ".demo-sheet.local",
      "production",
      "oauth-token.json",
    ),
  },
  {
    key: "GITHUB_TOKEN",
    sourcePath: "",
  },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(USAGE + "\n");
    return;
  }

  const outputPath = resolveOutputPath(options);
  const entries = [];

  for (const source of SECRET_SOURCES) {
    entries.push(await readSecretEntry(source));
  }

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, entries.join("\n") + "\n", "utf8");
  await fsp.chmod(outputPath, 0o600);

  process.stdout.write(
    "Wrote " +
      path.relative(ROOT_DIR, outputPath) +
      " with " +
      entries.length +
      " secret" +
      (entries.length === 1 ? "" : "s") +
      ".\n",
  );
}

function parseArgs(argv) {
  const options = {
    help: false,
    outputPath: DEFAULT_OUTPUT_PATH,
  };
  let i;

  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--output") {
      i += 1;
      if (i >= argv.length) {
        throw new Error(
          "Usage: node tools/act/create-secrets.js [--output <path>]",
        );
      }
      options.outputPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (argv[i] === "--help" || argv[i] === "-h") {
      options.help = true;
      return options;
    }

    throw new Error("Unknown argument: " + argv[i]);
  }

  return options;
}

function resolveOutputPath(options) {
  return (options && options.outputPath) || DEFAULT_OUTPUT_PATH;
}

async function readSecretEntry(source) {
  if (source.key === "GITHUB_TOKEN") {
    return source.key + "=" + getGithubTokenValue();
  }

  let raw;

  try {
    raw = await fsp.readFile(source.sourcePath, "utf8");
  } catch (error) {
    throw new Error(
      "Missing required secret source file for " +
        source.key +
        " at " +
        source.sourcePath +
        ".\n" +
        String(error && error.message ? error.message : error),
    );
  }

  return source.key + "=" + normalizeSecretValue(raw, source.sourcePath);
}

function normalizeSecretValue(raw, sourcePath) {
  const text = String(raw || "").trim();

  if (!text) {
    throw new Error("Secret source file is empty: " + sourcePath);
  }

  try {
    return JSON.stringify(JSON.parse(text));
  } catch (error) {
    return text.replace(/\r?\n/g, "");
  }
}

function getGithubTokenValue() {
  const token = String(
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
  ).trim();

  return token || "ghs_local_act";
}

main().catch(function (error) {
  process.stderr.write(
    String(error && error.message ? error.message : error) + "\n",
  );
  process.exitCode = 1;
});
