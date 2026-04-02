#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const names = process.argv.slice(2);

if (!names.length) {
  console.error("Usage: node tools/validate-json-secret.js <ENV_NAME>...");
  process.exit(1);
}

for (const name of names) {
  validateJsonEnv(name);
}

function validateJsonEnv(name) {
  const raw = process.env[name];

  if (!raw || !String(raw).trim()) {
    reportError(name, "Missing " + name + " environment variable.");
    process.exit(1);
  }

  try {
    JSON.parse(raw);
  } catch (error) {
    reportError(
      name,
      name +
        " must contain valid JSON: " +
        String(error && error.message ? error.message : error),
    );
    process.exit(1);
  }

  process.stdout.write("Validated JSON secret: " + name + "\n");
}

function reportError(name, message) {
  const annotation =
    "::error title=JSON secret validation::" +
    message.replace(/[\r\n]+/g, " ").trim();

  console.error(annotation);
  console.error(message);
}
