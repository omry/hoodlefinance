#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const { spawn } = require("node:child_process");
const { getClaspAuth, getClaspCommand } = require("./clasp-auth.js");

async function main() {
  const claspCommand = getClaspCommand();
  const claspAuth = getClaspAuth();
  const output = await runCommand(
    claspCommand,
    claspAuth.authArgs.concat(["show-authorized-user"]),
  );
  const normalizedOutput = String(output || "").trim();

  if (!normalizedOutput) {
    reportError(
      "clasp auth validation returned no authorized user details.",
    );
    process.exit(1);
  }

  if (/^not logged in/i.test(normalizedOutput)) {
    reportError(
      "clasp reported that the provided auth JSON is not logged in.",
    );
    process.exit(1);
  }

  if (/unknown user/i.test(normalizedOutput)) {
    reportError(
      "clasp could not determine the authorized user from the provided auth JSON.",
    );
    process.exit(1);
  }

  process.stdout.write("Validated clasp auth: " + normalizedOutput + "\n");
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
        reject(
          new Error(
            (stderr || stdout || "").trim() ||
              command + " exited with code " + code,
          ),
        );
        return;
      }

      resolve(stdout || stderr || "");
    });
  });
}

function reportError(message) {
  const normalizedMessage = message.replace(/[\r\n]+/g, " ").trim();

  console.error(
    "::error title=clasp auth validation::" + normalizedMessage,
  );
  console.error(message);
}

main().catch(function (error) {
  reportError(
    "Unable to use the provided clasp auth JSON: " +
      String(error && error.message ? error.message : error),
  );
  process.exitCode = 1;
});
