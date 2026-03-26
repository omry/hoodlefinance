#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { getClaspCommand, getClaspAuth } = require("./clasp-auth.js");

const ROOT_DIR = path.resolve(__dirname, "..");

function resolvePreferredLocalPath(primaryPath, legacyPath) {
  try {
    fs.accessSync(primaryPath);
    return primaryPath;
  } catch (error) {
    if (legacyPath) {
      try {
        fs.accessSync(legacyPath);
        return legacyPath;
      } catch (legacyError) {
        // Fall back to the primary path shown in docs.
      }
    }
  }

  return primaryPath;
}

const AUTH_SLOTS = [
  {
    label: "staging demo",
    authPath: path.join(ROOT_DIR, ".demo-sheet.local", "staging", ".clasprc.json"),
  },
  {
    label: "production demo",
    authPath: resolvePreferredLocalPath(
      path.join(ROOT_DIR, ".demo-sheet.local", "production", ".clasprc.json"),
      path.join(ROOT_DIR, ".demo-sheet.local", "live-demo", ".clasprc.json")
    ),
  },
  {
    label: "add-on production",
    authPath: resolvePreferredLocalPath(
      path.join(ROOT_DIR, ".addon-deploy.local", "production", ".clasprc.json"),
      path.join(ROOT_DIR, ".addon-deploy.local", ".clasprc.json")
    ),
  },
  {
    label: "add-on staging",
    authPath: path.join(ROOT_DIR, ".addon-deploy.local", "staging", ".clasprc.json"),
  },
];

async function main() {
  const claspCommand = getClaspCommand();

  for (let i = 0; i < AUTH_SLOTS.length; i += 1) {
    const slot = AUTH_SLOTS[i];
    const claspAuth = getClaspAuth(slot.authPath);

    process.stdout.write("\n[" + slot.label + "]\n");
    process.stdout.write("Auth file: " + slot.authPath + "\n");

    try {
      await runCommand(claspCommand, claspAuth.authArgs.concat(["show-authorized-user"]));
    } catch (error) {
      process.stdout.write("Not logged in or auth file missing.\n");
    }
  }
}

function runCommand(command, args) {
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

main().catch(function (error) {
  process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
  process.exitCode = 1;
});
