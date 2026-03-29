#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const VERSION_SOURCE_PATTERN =
  /const HOODLEFINANCE_VERSION_ = "([^"]+)";/;

function resolveUtcOffsetMinutes(now, options) {
  const normalizedOptions = options || {};
  const date = now instanceof Date ? new Date(now.getTime()) : new Date();

  if (typeof normalizedOptions.utcOffsetMinutes === "number") {
    return normalizedOptions.utcOffsetMinutes;
  }

  return -date.getTimezoneOffset();
}

function buildLocalTimestamp(now, options) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date();
  const utcOffsetMinutes = resolveUtcOffsetMinutes(date, options);
  const localIso = new Date(
    date.getTime() + utcOffsetMinutes * 60000,
  ).toISOString();

  return (
    localIso.replace("T", "_").replace(/:/g, "-").slice(0, 19) +
    (utcOffsetMinutes >= 0 ? "+" : "-") +
    String(Math.floor(Math.abs(utcOffsetMinutes) / 60)).padStart(2, "0") +
    String(Math.abs(utcOffsetMinutes) % 60).padStart(2, "0")
  );
}

function buildStampedVersion(version, now, options) {
  return String(version).trim() + "-dev-" + buildLocalTimestamp(now, options);
}

function stampVersionInSource(sourceText, now, options) {
  return String(sourceText).replace(
    VERSION_SOURCE_PATTERN,
    function (_, version) {
      return (
        'const HOODLEFINANCE_VERSION_ = "' +
        buildStampedVersion(version, now, options) +
        '";'
      );
    },
  );
}

module.exports = {
  buildLocalTimestamp,
  buildStampedVersion,
  stampVersionInSource,
};
