"use strict";

const fs = require("node:fs");

function normalizeLevel(level) {
  const normalizedLevel = String(level || "UNKNOWN").trim().toUpperCase();

  if (
    normalizedLevel === "OK" ||
    normalizedLevel === "ATTENTION" ||
    normalizedLevel === "WARNING" ||
    normalizedLevel === "ERROR" ||
    normalizedLevel === "UNKNOWN"
  ) {
    return normalizedLevel;
  }

  return "UNKNOWN";
}

function printContextBlock(title, rows, output, options) {
  const stream = output || process.stdout;
  const normalizedOptions = options || {};
  const suffix = normalizedOptions.trailingBlankLine ? "\n\n" : "\n";
  let i;

  stream.write("--- " + title + " ---\n");
  for (i = 0; i < rows.length; i += 1) {
    stream.write(rows[i].label + ": " + rows[i].value + "\n");
  }
  stream.write("-".repeat(String(title).length + 8) + suffix);
}

function getPathStatus(filePath, existsSync) {
  const hasPath = Boolean(String(filePath || "").trim());
  const pathExists = existsSync || fs.existsSync;

  if (!hasPath) {
    return "unknown";
  }

  return pathExists(filePath) ? "found" : "missing";
}

function getStatusIcon(level) {
  const normalizedLevel = normalizeLevel(level);

  if (normalizedLevel === "OK") {
    return "✅";
  }

  if (normalizedLevel === "WARNING") {
    return "⚠️";
  }

  if (normalizedLevel === "ATTENTION") {
    return "❗";
  }

  if (normalizedLevel === "ERROR") {
    return "❌";
  }

  return "❔";
}

function pathStatusToLevel(status, options) {
  const normalizedOptions = options || {};

  if (status === "found") {
    return normalizeLevel(normalizedOptions.foundLevel || "OK");
  }

  if (status === "missing") {
    return normalizeLevel(normalizedOptions.missingLevel || "ERROR");
  }

  return normalizeLevel(normalizedOptions.unknownLevel || "UNKNOWN");
}

function buildStatusRow(entry) {
  const normalizedEntry = entry || {};

  return {
    label: getStatusIcon(normalizedEntry.level) + " " + normalizedEntry.label,
    value: normalizedEntry.value,
  };
}

function buildPathRows(entries, options) {
  const normalizedOptions = options || {};
  const pathFallback = normalizedOptions.pathFallback || "<unknown>";
  const prefixStatusIcon = normalizedOptions.prefixStatusIcon === true;
  const prefixStatusIconOnLabel = normalizedOptions.prefixStatusIconOnLabel === true;
  const rows = [];
  let i;
  let entry;
  let level;
  let status;
  let label;
  let value;

  for (i = 0; i < entries.length; i += 1) {
    entry = entries[i];
    status = getPathStatus(entry.path, normalizedOptions.existsSync);
    level = entry.level
      ? normalizeLevel(entry.level)
      : pathStatusToLevel(status, {
          foundLevel: entry.foundLevel || normalizedOptions.foundLevel,
          missingLevel: entry.missingLevel || normalizedOptions.missingLevel,
          unknownLevel: entry.unknownLevel || normalizedOptions.unknownLevel,
        });
    label = entry.label;
    value = String(entry.path || "").trim() || pathFallback;
    if (prefixStatusIconOnLabel) {
      label = getStatusIcon(level) + " " + label;
    }
    if (prefixStatusIcon) {
      value = getStatusIcon(level) + " " + value;
    }

    rows.push({
      label: label,
      value: value,
    });

    if (entry.statusLabel) {
      rows.push({
        label: entry.statusLabel,
        value: status,
      });
    }
  }

  return rows;
}

module.exports = {
  buildPathRows,
  buildStatusRow,
  getPathStatus,
  getStatusIcon,
  normalizeLevel,
  pathStatusToLevel,
  printContextBlock,
};
