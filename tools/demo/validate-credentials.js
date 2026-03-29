#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { getClaspAuth, getClaspCommand } = require("../clasp-auth.js");
const { ensureAccessTokenWithDeps } = require("./google.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/userinfo.email",
];

async function main() {
  const oauthClientPath = requireEnvPath("DEMO_SHEET_OAUTH_CLIENT_PATH");
  const oauthTokenPath = requireEnvPath("DEMO_SHEET_OAUTH_TOKEN_PATH");
  const accessToken = await ensureAccessTokenWithDeps({
    authorizeInteractively: async function () {
      throw new Error(
        "Demo-sheet OAuth token requires interactive authorization. Update the stored demo-sheet OAuth secrets and retry.",
      );
    },
    nonInteractive: true,
    oauthClientPath: oauthClientPath,
    oauthTokenPath: oauthTokenPath,
    readJsonSync: readJsonSync,
    readOptionalJsonSync: readOptionalJsonSync,
    saveJson: async function () {
      // CI validation must not persist refreshed tokens.
    },
    scopes: GOOGLE_SCOPES,
  });
  const claspIdentity = await getClaspIdentity();
  const tokenIdentity = await getTokenIdentity(accessToken);

  process.stdout.write("OAuth token identity: " + tokenIdentity + "\n");
  process.stdout.write("clasp identity: " + claspIdentity + "\n");
}

function requireEnvPath(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error("Missing required environment variable: " + name);
  }

  return value;
}

function readJsonSync(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      "Unable to read " +
        label +
        " at " +
        filePath +
        ": " +
        String(error && error.message ? error.message : error),
    );
  }
}

function readOptionalJsonSync(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function getTokenIdentity(accessToken) {
  const response = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?access_token=" +
      encodeURIComponent(accessToken),
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      "OAuth token validation failed: " +
        JSON.stringify(
          payload && typeof payload === "object"
            ? payload
            : { error: response.statusText },
        ),
    );
  }

  return String(payload.email || "").trim() || "(Email unavailable)";
}

async function getClaspIdentity() {
  const claspCommand = getClaspCommand(ROOT_DIR);
  const claspAuth = getClaspAuth();
  const output = await runCommand(
    claspCommand,
    claspAuth.authArgs.concat(["show-authorized-user"]),
  );
  const normalizedOutput = output.trim();
  const emailMatch = normalizedOutput.match(/([^ ]+@[^ ]+\.[^ \r\n]+)/);

  if (emailMatch) {
    return emailMatch[1].replace(/[.,;:]+$/, "");
  }

  if (!normalizedOutput) {
    return "(Logged in, no user details returned)";
  }

  return normalizedOutput.split(/\r?\n/)[0];
}

function runCommand(command, args) {
  return new Promise(function (resolve, reject) {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

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

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(
      String(error && error.stack ? error.stack : error) + "\n",
    );
    process.exitCode = 1;
  });
}
