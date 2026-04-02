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
    console.error("Missing " + name + " environment variable.");
    process.exit(1);
  }

  try {
    JSON.parse(raw);
  } catch (error) {
    console.error(
      name +
        " must contain valid JSON: " +
        String(error && error.message ? error.message : error),
    );
    process.exit(1);
  }
}
