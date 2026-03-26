#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { getClaspCommand, getClaspAuth } = require("./clasp-auth.js");
const { getStatusIcon } = require("./cli-reporting.js");
const { getClaspUserSlots } = require("./clasp-user-slots.js");

async function main() {
  const claspCommand = getClaspCommand();
  const authSlots = getClaspUserSlots();

  for (let i = 0; i < authSlots.length; i += 1) {
    const slot = authSlots[i];
    const claspAuth = getClaspAuth(slot.authPath);
    const hasAuthFile = Boolean(slot.authPath) && fs.existsSync(slot.authPath);

    process.stdout.write("\n[" + slot.label + "]\n");
    process.stdout.write(getStatusIcon(hasAuthFile ? "OK" : "ERROR") + " Auth file: " + slot.authPath + "\n");

    if (!hasAuthFile) {
      process.stdout.write(getStatusIcon("ERROR") + " Not logged in or auth file missing.\n");
      continue;
    }

    try {
      process.stdout.write(formatClaspUserLine(await runCommand(claspCommand, claspAuth.authArgs.concat(["show-authorized-user"]))) + "\n");
    } catch (error) {
      process.stdout.write(getStatusIcon("ERROR") + " Not logged in or auth file missing.\n");
    }
  }
}

function runCommand(command, args) {
  return new Promise(function (resolve, reject) {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout.on("data", function (chunk) {
      stdout += chunk;
    });
    child.stderr.on("data", function (chunk) {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", function (code) {
      if (code !== 0) {
        reject(new Error(command + " exited with code " + code));
        return;
      }
      resolve((stdout || stderr || "").trim());
    });
  });
}

function formatClaspUserLine(output) {
  const normalizedOutput = String(output || "").trim();

  if (!normalizedOutput) {
    return getStatusIcon("UNKNOWN") + " Logged in, but clasp returned no user details.";
  }

  if (/^not logged in/i.test(normalizedOutput)) {
    return getStatusIcon("ERROR") + " " + normalizedOutput;
  }

  if (/unknown user/i.test(normalizedOutput)) {
    return getStatusIcon("UNKNOWN") + " " + normalizedOutput;
  }

  return getStatusIcon("OK") + " " + normalizedOutput;
}

main().catch(function (error) {
  process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
  process.exitCode = 1;
});
