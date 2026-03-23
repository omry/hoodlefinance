#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const {
  getClaspCommand,
  getClaspAuth,
} = require("./clasp-auth.js");

async function main() {
  const claspCommand = getClaspCommand();
  const claspAuth = getClaspAuth();

  process.stdout.write("Auth source: " + claspAuth.authSource + "\n");
  await runCommand(claspCommand, claspAuth.authArgs.concat(["show-authorized-user"]), {
  });
}

function runCommand(command, args, options) {
  const normalizedOptions = options || {};

  return new Promise(function (resolve, reject) {
    const child = spawn(command, args, {
      env: normalizedOptions.env || process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", function (code) {
      if (code !== 0) {
        reject(new Error(command + " " + args.join(" ") + " failed with exit code " + code + "."));
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
