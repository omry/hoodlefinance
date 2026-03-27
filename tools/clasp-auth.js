/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_CLASP_LOCAL_DIR = path.join(ROOT_DIR, ".clasp.local");
const DEFAULT_CLASP_RC_PATH = path.join(
  DEFAULT_CLASP_LOCAL_DIR,
  ".clasprc.json",
);
const CLASP_RC_PATH_ENV_VAR = "CLASP_RC_PATH";

function getClaspCommand(rootDir) {
  const baseDir = rootDir || ROOT_DIR;
  const localClaspPath = path.join(
    baseDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "clasp.cmd" : "clasp",
  );

  if (fs.existsSync(localClaspPath)) {
    return localClaspPath;
  }

  return "clasp";
}

function getClaspAuth(customDefaultPath) {
  const defaultPath = customDefaultPath || DEFAULT_CLASP_RC_PATH;
  const authPath =
    String(process.env[CLASP_RC_PATH_ENV_VAR] || "").trim() || defaultPath;

  return {
    authArgs: ["-A", authPath],
    authSource:
      authPath === defaultPath && !customDefaultPath
        ? DEFAULT_CLASP_RC_PATH
        : process.env[CLASP_RC_PATH_ENV_VAR]
          ? CLASP_RC_PATH_ENV_VAR
          : authPath,
  };
}

module.exports = {
  CLASP_RC_PATH_ENV_VAR,
  DEFAULT_CLASP_LOCAL_DIR,
  DEFAULT_CLASP_RC_PATH,
  getClaspCommand,
  getClaspAuth,
};
