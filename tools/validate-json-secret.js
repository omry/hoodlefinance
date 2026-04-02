#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const args = process.argv.slice(2);
const options = parseArgs(args);

if (!options.names.length) {
  console.error(
    "Usage: node tools/validate-json-secret.js [--clasp-auth] <ENV_NAME>...",
  );
  process.exit(1);
}

for (const name of options.names) {
  validateJsonEnv(name, options.requireClaspAuth);
}

function parseArgs(argv) {
  const result = {
    names: [],
    requireClaspAuth: false,
  };

  for (const arg of argv) {
    if (arg === "--clasp-auth") {
      result.requireClaspAuth = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      result.names = [];
      return result;
    }

    result.names.push(arg);
  }

  return result;
}

function validateJsonEnv(name, requireClaspAuth) {
  const raw = process.env[name];

  if (!raw || !String(raw).trim()) {
    reportError(name, "Missing " + name + " environment variable.");
    process.exit(1);
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    reportError(
      name,
      name +
        " must contain valid JSON: " +
        String(error && error.message ? error.message : error),
    );
    process.exit(1);
  }

  if (requireClaspAuth) {
    validateClaspAuthShape(name, parsed);
  }
}

function reportError(name, message) {
  const annotation =
    "::error title=JSON secret validation::" +
    message.replace(/[\r\n]+/g, " ").trim();

  console.error(annotation);
  console.error(message);
}

function validateClaspAuthShape(name, value) {
  const tokens = value && value.tokens;
  const defaultToken = tokens && tokens.default;
  const missing = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    missing.push("top-level object");
  }
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    missing.push("tokens object");
  }
  if (
    !defaultToken ||
    typeof defaultToken !== "object" ||
    Array.isArray(defaultToken)
  ) {
    missing.push("tokens.default object");
  }
  if (!defaultToken || typeof defaultToken.client_id !== "string") {
    missing.push("tokens.default.client_id");
  }
  if (!defaultToken || typeof defaultToken.client_secret !== "string") {
    missing.push("tokens.default.client_secret");
  }
  if (!defaultToken || typeof defaultToken.refresh_token !== "string") {
    missing.push("tokens.default.refresh_token");
  }
  if (!defaultToken || defaultToken.type !== "authorized_user") {
    missing.push('tokens.default.type="authorized_user"');
  }

  if (missing.length) {
    reportError(
      name,
      name + " does not look like a clasp auth JSON object: missing " + missing.join(", "),
    );
    process.exit(1);
  }
}
