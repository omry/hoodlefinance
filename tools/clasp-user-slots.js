"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

function getClaspUserSlots(rootDir) {
  const baseDir = rootDir || ROOT_DIR;

  return [
    {
      flag: "--demo-staging",
      key: "demo-staging",
      label: "staging demo",
      authPath: path.join(baseDir, ".demo-sheet.local", "staging", ".clasprc.json"),
      oauthClientPath: path.join(baseDir, ".demo-sheet.local", "staging", "oauth-client.json"),
    },
    {
      flag: "--demo-production",
      key: "demo-production",
      label: "production demo",
      authPath: resolvePreferredLocalPath(
        path.join(baseDir, ".demo-sheet.local", "production", ".clasprc.json"),
        path.join(baseDir, ".demo-sheet.local", "live-demo", ".clasprc.json")
      ),
      oauthClientPath: resolvePreferredLocalPath(
        path.join(baseDir, ".demo-sheet.local", "production", "oauth-client.json"),
        path.join(baseDir, ".demo-sheet.local", "live-demo", "oauth-client.json")
      ),
    },
    {
      flag: "--addon-production",
      key: "addon-production",
      label: "add-on production",
      authPath: resolvePreferredLocalPath(
        path.join(baseDir, ".addon-deploy.local", "production", ".clasprc.json"),
        path.join(baseDir, ".addon-deploy.local", ".clasprc.json")
      ),
      oauthClientPath: resolvePreferredLocalPath(
        path.join(baseDir, ".addon-deploy.local", "production", "oauth-client.json"),
        path.join(baseDir, ".addon-deploy.local", "oauth-client.json")
      ),
    },
    {
      flag: "--addon-staging",
      key: "addon-staging",
      label: "add-on staging",
      authPath: path.join(baseDir, ".addon-deploy.local", "staging", ".clasprc.json"),
      oauthClientPath: path.join(baseDir, ".addon-deploy.local", "staging", "oauth-client.json"),
    },
  ];
}

function getClaspUserSlotByKey(slotKey, rootDir) {
  const normalizedSlotKey = String(slotKey || "").trim().toLowerCase();

  return getClaspUserSlots(rootDir).find(function (slot) {
    return slot.key === normalizedSlotKey;
  }) || null;
}

module.exports = {
  getClaspUserSlotByKey,
  getClaspUserSlots,
  resolvePreferredLocalPath,
  ROOT_DIR,
};
