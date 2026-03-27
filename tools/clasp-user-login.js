#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { getClaspAuth, getClaspCommand } = require("./clasp-auth.js");
const {
  ROOT_DIR,
  getClaspUserSlotByKey,
  getClaspUserSlots,
} = require("./clasp-user-slots.js");

function parseArgs(argv) {
  const options = {
    credsPath: "",
    noLocalhost: false,
    slotKey: "",
  };
  const slots = getClaspUserSlots();
  let i;
  let current;
  let matchedSlot;

  for (i = 0; i < argv.length; i += 1) {
    current = argv[i];
    matchedSlot = slots.find(function (slot) {
      return slot.flag === current;
    });

    if (matchedSlot) {
      if (options.slotKey && options.slotKey !== matchedSlot.key) {
        throw new Error("Choose exactly one clasp auth slot to log into.");
      }
      options.slotKey = matchedSlot.key;
      continue;
    }

    if (current === "--creds") {
      i += 1;
      if (i >= argv.length) {
        throw new Error(
          "Usage: node tools/clasp-user-login.js [--demo-staging|--demo-production|--addon-staging|--addon-production] [--creds <path>] [--no-localhost]",
        );
      }
      options.credsPath = path.resolve(ROOT_DIR, argv[i]);
      continue;
    }

    if (current === "--no-localhost") {
      options.noLocalhost = true;
      continue;
    }

    throw new Error("Unknown argument: " + current);
  }

  if (!options.slotKey) {
    throw new Error(
      "Choose a clasp auth slot to log into: --demo-staging, --demo-production, --addon-staging, or --addon-production.",
    );
  }

  return options;
}

function getClaspLoginContext(options, overrides) {
  const normalizedOptions = options || {};
  const normalizedOverrides = overrides || {};
  const rootDir = normalizedOverrides.rootDir || ROOT_DIR;
  const slot = getClaspUserSlotByKey(normalizedOptions.slotKey, rootDir);
  const credsPath =
    normalizedOptions.credsPath || (slot && slot.oauthClientPath) || "";

  if (!slot) {
    throw new Error("Unknown clasp auth slot: " + normalizedOptions.slotKey);
  }

  return {
    authPath: slot.authPath,
    credsPath: credsPath,
    flag: slot.flag,
    key: slot.key,
    label: slot.label,
  };
}

async function runCommand(command, args) {
  return new Promise(function (resolve, reject) {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("close", function (code) {
      if (code !== 0) {
        reject(new Error(command + " exited with code " + code));
        return;
      }
      resolve();
    });
  });
}

function isExpectedCliError(error) {
  const message = String(error && error.message ? error.message : error);

  return (
    /^Choose exactly one clasp auth slot to log into\./i.test(message) ||
    /^Choose a clasp auth slot to log into:/i.test(message) ||
    /^Unknown argument:/i.test(message) ||
    /^Usage:/i.test(message) ||
    /^OAuth client JSON not found at /i.test(message)
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const context = getClaspLoginContext(options);
  const claspCommand = getClaspCommand(ROOT_DIR);
  const claspAuth = getClaspAuth(context.authPath);
  const args = claspAuth.authArgs.concat(["login"]);

  if (!context.credsPath || !fs.existsSync(context.credsPath)) {
    throw new Error(
      "OAuth client JSON not found at " +
        (context.credsPath || "<missing path>") +
        ".\n" +
        "Expected creds for " +
        context.label +
        ".",
    );
  }

  if (options.noLocalhost) {
    args.push("--no-localhost");
  }

  args.push("--creds", context.credsPath);

  process.stdout.write("Logging into [" + context.label + "]\n");
  process.stdout.write("Auth file: " + context.authPath + "\n");
  process.stdout.write("OAuth client: " + context.credsPath + "\n");
  await runCommand(claspCommand, args);
}

module.exports = {
  getClaspLoginContext,
  isExpectedCliError,
  parseArgs,
};

if (require.main === module) {
  main().catch(function (error) {
    const output = isExpectedCliError(error)
      ? String(error && error.message ? error.message : error)
      : String(error && error.stack ? error.stack : error);
    process.stderr.write(output + "\n");
    process.exitCode = 1;
  });
}
