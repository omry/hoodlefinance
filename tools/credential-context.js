"use strict";

const fs = require("node:fs");

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

function getStatusIcon(status) {
  if (status === "found") {
    return "✅";
  }

  if (status === "missing") {
    return "❌";
  }

  return "❔";
}

function buildPathRows(entries, options) {
  const normalizedOptions = options || {};
  const pathFallback = normalizedOptions.pathFallback || "<unknown>";
  const prefixStatusIcon = normalizedOptions.prefixStatusIcon === true;
  const prefixStatusIconOnLabel = normalizedOptions.prefixStatusIconOnLabel === true;
  const rows = [];
  let i;
  let entry;
  let status;
  let label;
  let value;

  for (i = 0; i < entries.length; i += 1) {
    entry = entries[i];
    status = getPathStatus(entry.path, normalizedOptions.existsSync);
    label = entry.label;
    value = String(entry.path || "").trim() || pathFallback;
    if (prefixStatusIconOnLabel) {
      label = getStatusIcon(status) + " " + label;
    }
    if (prefixStatusIcon) {
      value = getStatusIcon(status) + " " + value;
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
  getPathStatus,
  getStatusIcon,
  printContextBlock,
};
