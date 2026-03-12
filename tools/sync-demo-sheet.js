#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEMO_DIR = path.join(ROOT_DIR, "docs", "demo-sheet");
const CONFIG_PATH = path.join(DEMO_DIR, "demo-sheet.json");
const README_PATH = path.join(ROOT_DIR, "README.md");
const SCRIPT_SOURCE_PATH = path.join(ROOT_DIR, "hoodlefinance.js");
const LOCAL_DIR = path.join(ROOT_DIR, ".demo-sheet.local");
const OAUTH_CLIENT_PATH = path.join(LOCAL_DIR, "oauth-client.json");
const OAUTH_TOKEN_PATH = path.join(LOCAL_DIR, "oauth-token.json");
const CLASP_WORKDIR = path.join(LOCAL_DIR, "clasp-work");
const DEMO_MARKER_START = "<!-- DEMO_SHEET_LINK:START -->";
const DEMO_MARKER_END = "<!-- DEMO_SHEET_LINK:END -->";
const DEFAULT_MANIFEST = {
  exceptionLogging: "STACKDRIVER",
  runtimeVersion: "V8",
  timeZone: "Etc/UTC",
};
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.projects",
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadDemoSheetConfig(CONFIG_PATH);

  validateConfig(config);
  await ensureConfiguredTabFilesExist(config);

  if (options.dryRun) {
    printSummary(config, options, "Dry run completed. No network or clasp operations were performed.");
    return;
  }

  const accessToken = await ensureAccessToken();
  const syncedConfig = await syncDemoSheet(accessToken, config, options);

  await saveJson(CONFIG_PATH, syncedConfig);
  await updateReadmeDemoLink(syncedConfig.publicUrl || "");
  printSummary(syncedConfig, options, "Demo sheet sync completed.");
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    skipClasp: false,
    skipSharing: false,
  };
  let i;

  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argv[i] === "--skip-clasp") {
      options.skipClasp = true;
      continue;
    }

    if (argv[i] === "--skip-sharing") {
      options.skipSharing = true;
      continue;
    }

    throw new Error("Unknown argument: " + argv[i]);
  }

  return options;
}

function loadDemoSheetConfig(configPath) {
  return readJsonSync(configPath, "demo-sheet config");
}

function validateConfig(config) {
  const issues = [];
  const seenTitles = {};
  let i;
  let tab;

  if (!config || typeof config !== "object") {
    throw new Error("demo-sheet.json must contain a JSON object.");
  }

  if (!String(config.title || "").trim()) {
    issues.push("Missing top-level \"title\".");
  }

  if (!config.script || typeof config.script !== "object") {
    issues.push("Missing \"script\" object.");
  } else if (!String(config.script.title || "").trim()) {
    issues.push("Missing \"script.title\".");
  }

  if (!Array.isArray(config.tabs) || !config.tabs.length) {
    issues.push("Expected a non-empty \"tabs\" array.");
  } else {
    for (i = 0; i < config.tabs.length; i += 1) {
      tab = config.tabs[i];

      if (!tab || typeof tab !== "object") {
        issues.push("Tab entry #" + (i + 1) + " must be an object.");
        continue;
      }

      if (!String(tab.title || "").trim()) {
        issues.push("Tab entry #" + (i + 1) + " is missing \"title\".");
      } else if (seenTitles[tab.title]) {
        issues.push("Duplicate tab title: " + tab.title);
      } else {
        seenTitles[tab.title] = true;
      }

      if (!String(tab.path || "").trim()) {
        issues.push("Tab \"" + (tab.title || "#" + (i + 1)) + "\" is missing \"path\".");
      }

      if (!String(tab.startCell || "").trim()) {
        issues.push("Tab \"" + (tab.title || "#" + (i + 1)) + "\" is missing \"startCell\".");
      }

      validateTabFormatting(tab, issues, i + 1);
    }
  }

  if (issues.length) {
    throw new Error("Invalid demo-sheet config:\n- " + issues.join("\n- "));
  }

  return config;
}

function validateTabFormatting(tab, issues, index) {
  const formatting = tab && tab.formatting;
  const tabLabel = tab && tab.title ? tab.title : "#" + index;

  if (!formatting) {
    return;
  }

  if (formatting.freezeRows != null && (!Number.isInteger(formatting.freezeRows) || formatting.freezeRows < 0)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.freezeRows\".");
  }

  if (formatting.autoResizeColumns != null && typeof formatting.autoResizeColumns !== "boolean") {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.autoResizeColumns\".");
  }

  if (formatting.columnPixelSizes != null) {
    if (!Array.isArray(formatting.columnPixelSizes) || !formatting.columnPixelSizes.length) {
      issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.columnPixelSizes\".");
      return;
    }

    formatting.columnPixelSizes.forEach(function (size) {
      if (!Number.isInteger(size) || size <= 0) {
        issues.push("Tab \"" + tabLabel + "\" has invalid column pixel size: " + size);
      }
    });
  }

  validateColumnBackgrounds_(formatting.columnBackgrounds, tabLabel, issues);
  validateFormattingSections_(formatting.headerSections, "headerSections", tabLabel, issues);
  validateFormattingSections_(formatting.formulaSections, "formulaSections", tabLabel, issues);
  validateNumberFormats_(formatting.numberFormats, tabLabel, issues);
  validateRowNumbers_(formatting.calloutRows, "calloutRows", tabLabel, issues);
  validateMergedRanges_(formatting.mergedRanges, tabLabel, issues);

  validateRowNumbers_(formatting.headerRows, "headerRows", tabLabel, issues);
  validateRowNumbers_(formatting.formulaRows, "formulaRows", tabLabel, issues);

  if (formatting.formulaColumns != null) {
    if (!Array.isArray(formatting.formulaColumns)) {
      issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.formulaColumns\".");
      return;
    }

    formatting.formulaColumns.forEach(function (columnNumber) {
      if (!Number.isInteger(columnNumber) || columnNumber < 1) {
        issues.push("Tab \"" + tabLabel + "\" has invalid formula column number: " + columnNumber);
      }
    });
  }
}

function validateFormattingSections_(sections, label, tabLabel, issues) {
  if (sections == null) {
    return;
  }

  if (!Array.isArray(sections)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting." + label + "\".");
    return;
  }

  sections.forEach(function (section) {
    if (!section || typeof section !== "object") {
      issues.push("Tab \"" + tabLabel + "\" has invalid formatting section in \"" + label + "\".");
      return;
    }

    if (!Number.isInteger(section.row) || section.row < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid section row in \"" + label + "\": " + section.row);
    }

    if (!Number.isInteger(section.columns) || section.columns < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid section column count in \"" + label + "\": " + section.columns);
    }
  });
}

function validateRowNumbers_(rows, label, tabLabel, issues) {
  if (rows == null) {
    return;
  }

  if (!Array.isArray(rows)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting." + label + "\".");
    return;
  }

  rows.forEach(function (rowNumber) {
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " row number: " + rowNumber);
    }
  });
}

function validateNumberFormats_(numberFormats, tabLabel, issues) {
  if (numberFormats == null) {
    return;
  }

  if (!Array.isArray(numberFormats)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.numberFormats\".");
    return;
  }

  numberFormats.forEach(function (entry) {
    if (!entry || typeof entry !== "object") {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format entry.");
      return;
    }

    if (!Number.isInteger(entry.column) || entry.column < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format column: " + entry.column);
    }

    if (!Number.isInteger(entry.startRow) || entry.startRow < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format startRow: " + entry.startRow);
    }

    if (!Number.isInteger(entry.endRow) || entry.endRow < entry.startRow) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format endRow: " + entry.endRow);
    }

    if (!String(entry.type || "").trim()) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format type.");
    }

    if (!String(entry.pattern || "").trim()) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format pattern.");
    }
  });
}

function validateColumnBackgrounds_(columnBackgrounds, tabLabel, issues) {
  if (columnBackgrounds == null) {
    return;
  }

  if (!Array.isArray(columnBackgrounds)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.columnBackgrounds\".");
    return;
  }

  columnBackgrounds.forEach(function (entry) {
    if (!entry || typeof entry !== "object") {
      issues.push("Tab \"" + tabLabel + "\" has invalid column background entry.");
      return;
    }

    if (!Number.isInteger(entry.column) || entry.column < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid column background column: " + entry.column);
    }

    if (entry.startRow != null && (!Number.isInteger(entry.startRow) || entry.startRow < 1)) {
      issues.push("Tab \"" + tabLabel + "\" has invalid column background startRow: " + entry.startRow);
    }

    if (entry.endRow != null && (!Number.isInteger(entry.endRow) || entry.endRow < 1)) {
      issues.push("Tab \"" + tabLabel + "\" has invalid column background endRow: " + entry.endRow);
    }

    validateRgbColor_(entry.backgroundColor, "column background", tabLabel, issues);
  });
}

function validateRgbColor_(color, label, tabLabel, issues) {
  const components = ["red", "green", "blue"];

  if (!color || typeof color !== "object") {
    issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " color.");
    return;
  }

  components.forEach(function (name) {
    if (typeof color[name] !== "number" || Number.isNaN(color[name]) || color[name] < 0 || color[name] > 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " color component \"" + name + "\".");
    }
  });
}

function validateMergedRanges_(mergedRanges, tabLabel, issues) {
  if (mergedRanges == null) {
    return;
  }

  if (!Array.isArray(mergedRanges)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.mergedRanges\".");
    return;
  }

  mergedRanges.forEach(function (range) {
    if (!range || typeof range !== "object") {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range entry.");
      return;
    }

    if (!Number.isInteger(range.startRow) || range.startRow < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range startRow: " + range.startRow);
    }
    if (!Number.isInteger(range.endRow) || range.endRow < range.startRow) {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range endRow: " + range.endRow);
    }
    if (!Number.isInteger(range.startColumn) || range.startColumn < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range startColumn: " + range.startColumn);
    }
    if (!Number.isInteger(range.endColumn) || range.endColumn < range.startColumn) {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range endColumn: " + range.endColumn);
    }
  });
}

async function ensureConfiguredTabFilesExist(config) {
  let i;

  for (i = 0; i < config.tabs.length; i += 1) {
    try {
      await fsp.access(resolveRepoPath(config.tabs[i].path), fs.constants.R_OK);
    } catch (error) {
      throw new Error("Configured TSV file is missing or unreadable: " + config.tabs[i].path);
    }
  }
}

async function syncDemoSheet(accessToken, inputConfig, options) {
  const config = JSON.parse(JSON.stringify(inputConfig));
  let sheetMap;

  await ensureSpreadsheet(accessToken, config);
  await ensureTabs(accessToken, config);
  sheetMap = await fetchSpreadsheetSheetMap(accessToken, config.spreadsheetId);
  await resetTabFormatsBeforeWrite(accessToken, config, sheetMap);
  await writeTabs(accessToken, config);
  await applyTabFormatting(accessToken, config, sheetMap);

  if (config.sharePublicReadOnly && !options.skipSharing) {
    await ensurePublicReadPermission(accessToken, config.spreadsheetId);
  }

  await ensureBoundScriptProject(accessToken, config);

  if (!options.skipClasp) {
    await syncBoundScriptWithClasp(config);
  }

  config.publicUrl = buildSpreadsheetUrl(config.spreadsheetId);
  return config;
}

async function resetTabFormatsBeforeWrite(accessToken, config, sheetMap) {
  const requests = [];
  let i;
  let tab;
  let values;
  let sheetProperties;
  let maxColumns;
  let sheetColumnCount;
  let sheetRowCount;

  for (i = 0; i < config.tabs.length; i += 1) {
    tab = config.tabs[i];
    sheetProperties = sheetMap[tab.title];

    if (!sheetProperties) {
      continue;
    }

    values = parseTsv(await fsp.readFile(resolveRepoPath(tab.path), "utf8"));
    maxColumns = values.reduce(function (currentMax, row) {
      const width = Array.isArray(row) ? row.length : 0;
      return Math.max(currentMax, width);
    }, 1);
    sheetColumnCount = Math.max(
      (sheetProperties.gridProperties && sheetProperties.gridProperties.columnCount) || maxColumns || 1,
      maxColumns || 1
    );
    sheetRowCount = Math.max(
      (sheetProperties.gridProperties && sheetProperties.gridProperties.rowCount) || values.length || 1,
      values.length || 1
    );

    requests.push(buildBodyAlignmentRequest(sheetProperties.sheetId, sheetRowCount, sheetColumnCount));
  }

  if (!requests.length) {
    return;
  }

  await googleApiJson(
    accessToken,
    "POST",
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(config.spreadsheetId) +
      ":batchUpdate",
    { requests: requests }
  );
}

async function ensureSpreadsheet(accessToken, config) {
  const tabTitles = config.tabs.map(function (tab) {
    return tab.title;
  });

  if (config.spreadsheetId) {
    return;
  }

  const created = await googleApiJson(accessToken, "POST", "https://sheets.googleapis.com/v4/spreadsheets", {
    properties: {
      title: config.title,
    },
    sheets: tabTitles.map(function (title) {
      return {
        properties: {
          title: title,
        },
      };
    }),
  });

  config.spreadsheetId = created.spreadsheetId;
  config.publicUrl = created.spreadsheetUrl || buildSpreadsheetUrl(created.spreadsheetId);
  await persistDemoSheetConfig(config);
}

async function ensureTabs(accessToken, config) {
  const sheetMap = await fetchSpreadsheetSheetMap(accessToken, config.spreadsheetId);
  const existingByTitle = {};
  const requests = [];
  let i;

  Object.keys(sheetMap).forEach(function (title) {
    existingByTitle[title] = true;
  });

  for (i = 0; i < config.tabs.length; i += 1) {
    if (!existingByTitle[config.tabs[i].title]) {
      requests.push({
        addSheet: {
          properties: {
            title: config.tabs[i].title,
          },
        },
      });
    }
  }

  if (!requests.length) {
    return;
  }

  await googleApiJson(
    accessToken,
    "POST",
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(config.spreadsheetId) +
      ":batchUpdate",
    { requests: requests }
  );
}

async function fetchSpreadsheetSheetMap(accessToken, spreadsheetId) {
  const response = await googleApiJson(
    accessToken,
    "GET",
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(spreadsheetId) +
      "?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))"
  );
  const sheetMap = {};

  (response.sheets || []).forEach(function (sheet) {
    const properties = sheet && sheet.properties ? sheet.properties : null;
    const title = properties && properties.title ? properties.title : "";

    if (title) {
      sheetMap[title] = properties;
    }
  });

  return sheetMap;
}

async function writeTabs(accessToken, config) {
  let i;
  let tab;
  let values;

  for (i = 0; i < config.tabs.length; i += 1) {
    tab = config.tabs[i];
    values = parseTsv(await fsp.readFile(resolveRepoPath(tab.path), "utf8"));

    await googleApiJson(
      accessToken,
      "POST",
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(config.spreadsheetId) +
        "/values/" +
        encodeURIComponent(buildSheetRange(tab.title, "A:ZZZ")) +
        ":clear",
      {}
    );

    await googleApiJson(
      accessToken,
      "PUT",
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(config.spreadsheetId) +
        "/values/" +
        encodeURIComponent(buildSheetRange(tab.title, tab.startCell)) +
        "?valueInputOption=USER_ENTERED",
      {
        majorDimension: "ROWS",
        range: buildSheetRange(tab.title, tab.startCell),
        values: values,
      }
    );
  }
}

async function applyTabFormatting(accessToken, config, sheetMap) {
  const requests = [];
  let i;
  let tab;
  let values;
  let sheetProperties;
  let formatting;
  let maxColumns;
  let sheetColumnCount;
  let sheetRowCount;

  for (i = 0; i < config.tabs.length; i += 1) {
    tab = config.tabs[i];
    sheetProperties = sheetMap[tab.title];
    formatting = normalizeTabFormatting(tab.formatting);

    if (!sheetProperties || sheetProperties.sheetId == null) {
      throw new Error("Could not find a sheet ID for tab \"" + tab.title + "\".");
    }

    values = parseTsv(await fsp.readFile(resolveRepoPath(tab.path), "utf8"));
    maxColumns = values.reduce(function (currentMax, row) {
      return Math.max(currentMax, Array.isArray(row) ? row.length : 0);
    }, 0);
    sheetColumnCount =
      sheetProperties &&
      sheetProperties.gridProperties &&
      Number.isInteger(sheetProperties.gridProperties.columnCount) &&
      sheetProperties.gridProperties.columnCount > 0
        ? Math.max(sheetProperties.gridProperties.columnCount, maxColumns)
        : maxColumns;
    sheetRowCount =
      sheetProperties &&
      sheetProperties.gridProperties &&
      Number.isInteger(sheetProperties.gridProperties.rowCount) &&
      sheetProperties.gridProperties.rowCount > 0
        ? sheetProperties.gridProperties.rowCount
        : values.length;

    if (values.length > 0 && sheetColumnCount > 0) {
      requests.push(buildBodyAlignmentRequest(sheetProperties.sheetId, sheetRowCount, sheetColumnCount));
    }

    if (formatting.freezeRows > 0) {
      requests.push(buildFreezeRowsRequest(sheetProperties.sheetId, formatting.freezeRows));
    }

    formatting.mergedRanges.forEach(function (range) {
      requests.push(buildUnmergeCellsRequest(sheetProperties.sheetId, range));
      requests.push(buildMergeCellsRequest(sheetProperties.sheetId, range));
    });

    formatting.headerSections.forEach(function (section) {
      requests.push(buildHeaderRowFormatRequest(sheetProperties.sheetId, section.row, section.columns));
    });

    formatting.headerRows.forEach(function (rowNumber) {
      requests.push(buildHeaderRowFormatRequest(sheetProperties.sheetId, rowNumber, maxColumns));
    });

    formatting.calloutRows.forEach(function (rowNumber) {
      requests.push(buildCalloutRowFormatRequest(sheetProperties.sheetId, rowNumber, maxColumns));
    });

    formatting.formulaSections.forEach(function (section) {
      requests.push(buildFormulaRowFormatRequest(sheetProperties.sheetId, section.row, section.columns));
    });

    formatting.formulaRows.forEach(function (rowNumber) {
      requests.push(buildFormulaRowFormatRequest(sheetProperties.sheetId, rowNumber, maxColumns));
    });

    formatting.formulaColumns.forEach(function (columnNumber) {
      requests.push(buildFormulaColumnFormatRequest(sheetProperties.sheetId, columnNumber, values.length));
    });

    requests.push.apply(requests, buildFormulaCellFormatRequests(sheetProperties.sheetId, values));
    requests.push.apply(
      requests,
      buildColumnBackgroundRequests(sheetProperties.sheetId, formatting.columnBackgrounds, values.length)
    );
    requests.push.apply(requests, buildNumberFormatRequests(sheetProperties.sheetId, formatting.numberFormats));

    if (formatting.columnPixelSizes.length) {
      requests.push.apply(requests, buildColumnWidthRequests(sheetProperties.sheetId, formatting.columnPixelSizes));
    } else if (formatting.autoResizeColumns && maxColumns > 0) {
      requests.push(buildAutoResizeColumnsRequest(sheetProperties.sheetId, maxColumns));
    }
  }

  if (!requests.length) {
    return;
  }

  await googleApiJson(
    accessToken,
    "POST",
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(config.spreadsheetId) +
      ":batchUpdate",
    { requests: requests }
  );
}

function normalizeTabFormatting(formatting) {
  const normalized = formatting || {};

  return {
    autoResizeColumns: normalized.autoResizeColumns !== false,
    columnBackgrounds: Array.isArray(normalized.columnBackgrounds)
      ? normalized.columnBackgrounds.map(copyColumnBackground_)
      : [],
    columnPixelSizes: Array.isArray(normalized.columnPixelSizes) ? normalized.columnPixelSizes.slice() : [],
    freezeRows: Number(normalized.freezeRows || 0),
    formulaColumns: Array.isArray(normalized.formulaColumns) ? normalized.formulaColumns.slice() : [],
    formulaSections: Array.isArray(normalized.formulaSections)
      ? normalized.formulaSections.map(copyFormattingSection_)
      : [],
    formulaRows: Array.isArray(normalized.formulaRows) ? normalized.formulaRows.slice() : [],
    headerSections: Array.isArray(normalized.headerSections)
      ? normalized.headerSections.map(copyFormattingSection_)
      : [],
    headerRows: Array.isArray(normalized.headerRows) ? normalized.headerRows.slice() : [],
    calloutRows: Array.isArray(normalized.calloutRows) ? normalized.calloutRows.slice() : [],
    mergedRanges: Array.isArray(normalized.mergedRanges) ? normalized.mergedRanges.map(copyMergedRange_) : [],
    numberFormats: Array.isArray(normalized.numberFormats) ? normalized.numberFormats.map(copyNumberFormat_) : [],
  };
}

function copyFormattingSection_(section) {
  return {
    columns: Number(section.columns),
    row: Number(section.row),
  };
}

function copyColumnBackground_(entry) {
  return {
    backgroundColor: copyRgbColor_(entry.backgroundColor),
    column: Number(entry.column),
    endRow: entry.endRow == null ? null : Number(entry.endRow),
    startRow: entry.startRow == null ? null : Number(entry.startRow),
  };
}

function copyRgbColor_(color) {
  return {
    blue: Number(color.blue),
    green: Number(color.green),
    red: Number(color.red),
  };
}

function copyNumberFormat_(entry) {
  return {
    column: Number(entry.column),
    endRow: Number(entry.endRow),
    pattern: String(entry.pattern || ""),
    startRow: Number(entry.startRow),
    type: String(entry.type || ""),
  };
}

function copyMergedRange_(range) {
  return {
    endColumn: Number(range.endColumn),
    endRow: Number(range.endRow),
    startColumn: Number(range.startColumn),
    startRow: Number(range.startRow),
  };
}

function buildFreezeRowsRequest(sheetId, freezeRows) {
  return {
    updateSheetProperties: {
      fields: "gridProperties.frozenRowCount",
      properties: {
        gridProperties: {
          frozenRowCount: freezeRows,
        },
        sheetId: sheetId,
      },
    },
  };
}

function buildMergeCellsRequest(sheetId, range) {
  return {
    mergeCells: {
      mergeType: "MERGE_ALL",
      range: {
        startRowIndex: range.startRow - 1,
        endRowIndex: range.endRow,
        startColumnIndex: range.startColumn - 1,
        endColumnIndex: range.endColumn,
        sheetId: sheetId,
      },
    },
  };
}

function buildUnmergeCellsRequest(sheetId, range) {
  return {
    unmergeCells: {
      range: {
        startRowIndex: range.startRow - 1,
        endRowIndex: range.endRow,
        startColumnIndex: range.startColumn - 1,
        endColumnIndex: range.endColumn,
        sheetId: sheetId,
      },
    },
  };
}

function buildBodyAlignmentRequest(sheetId, maxRows, maxColumns) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 1,
            green: 1,
            blue: 1,
          },
          backgroundColorStyle: {
            rgbColor: {
              red: 1,
              green: 1,
              blue: 1,
            },
          },
          horizontalAlignment: "LEFT",
          textFormat: {
            bold: false,
            italic: false,
          },
        },
      },
      fields: "userEnteredFormat",
      range: {
        startRowIndex: 0,
        endRowIndex: maxRows,
        startColumnIndex: 0,
        endColumnIndex: maxColumns,
        sheetId: sheetId,
      },
    },
  };
}

function buildCalloutRowFormatRequest(sheetId, rowNumber, maxColumns) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.95,
            green: 0.95,
            blue: 0.95,
          },
          horizontalAlignment: "LEFT",
          textFormat: {
            bold: true,
            italic: false,
          },
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
      range: {
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: 0,
        endColumnIndex: maxColumns,
        sheetId: sheetId,
      },
    },
  };
}

function buildHeaderRowFormatRequest(sheetId, rowNumber, maxColumns) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.92,
            green: 0.92,
            blue: 0.92,
          },
          horizontalAlignment: "CENTER",
          textFormat: {
            bold: true,
          },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      range: {
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: 0,
        endColumnIndex: maxColumns,
        sheetId: sheetId,
      },
    },
  };
}

function buildFormulaRowFormatRequest(sheetId, rowNumber, maxColumns) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.96,
            green: 0.94,
            blue: 0.88,
          },
          textFormat: {
            italic: true,
          },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
      range: {
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: 0,
        endColumnIndex: maxColumns,
        sheetId: sheetId,
      },
    },
  };
}

function buildFormulaColumnFormatRequest(sheetId, columnNumber, maxRows) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.96,
            green: 0.94,
            blue: 0.88,
          },
          textFormat: {
            italic: true,
          },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
      range: {
        startRowIndex: 0,
        endRowIndex: maxRows,
        startColumnIndex: columnNumber - 1,
        endColumnIndex: columnNumber,
        sheetId: sheetId,
      },
    },
  };
}

function buildFormulaCellFormatRequests(sheetId, values) {
  const requests = [];
  let rowIndex;
  let columnIndex;
  let row;
  let value;

  for (rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    row = Array.isArray(values[rowIndex]) ? values[rowIndex] : [];

    for (columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      value = String(row[columnIndex] == null ? "" : row[columnIndex]);

      if (value.indexOf("'") === 0) {
        requests.push(buildFormulaCellFormatRequest(sheetId, rowIndex + 1, columnIndex + 1));
      }
    }
  }

  return requests;
}

function buildFormulaCellFormatRequest(sheetId, rowNumber, columnNumber) {
  return {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.96,
            green: 0.94,
            blue: 0.88,
          },
          horizontalAlignment: "LEFT",
          textFormat: {
            italic: true,
          },
          wrapStrategy: "WRAP",
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,wrapStrategy)",
      range: {
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: columnNumber - 1,
        endColumnIndex: columnNumber,
        sheetId: sheetId,
      },
    },
  };
}

function buildAutoResizeColumnsRequest(sheetId, maxColumns) {
  return {
    autoResizeDimensions: {
      dimensions: {
        dimension: "COLUMNS",
        startIndex: 0,
        endIndex: maxColumns,
        sheetId: sheetId,
      },
    },
  };
}

function buildColumnWidthRequests(sheetId, columnPixelSizes) {
  return columnPixelSizes.map(function (pixelSize, index) {
    return {
      updateDimensionProperties: {
        fields: "pixelSize",
        properties: {
          pixelSize: pixelSize,
        },
        range: {
          dimension: "COLUMNS",
          startIndex: index,
          endIndex: index + 1,
          sheetId: sheetId,
        },
      },
    };
  });
}

function buildNumberFormatRequests(sheetId, numberFormats) {
  return numberFormats.map(function (entry) {
    return {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            numberFormat: {
              pattern: entry.pattern,
              type: entry.type,
            },
          },
        },
        fields: "userEnteredFormat.numberFormat",
        range: {
          startRowIndex: entry.startRow - 1,
          endRowIndex: entry.endRow,
          startColumnIndex: entry.column - 1,
          endColumnIndex: entry.column,
          sheetId: sheetId,
        },
      },
    };
  });
}

function buildColumnBackgroundRequests(sheetId, columnBackgrounds, maxRows) {
  return columnBackgrounds.map(function (entry) {
    return {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor: copyRgbColor_(entry.backgroundColor),
          },
        },
        fields: "userEnteredFormat.backgroundColor",
        range: {
          startRowIndex: Math.max(0, Number(entry.startRow || 1) - 1),
          endRowIndex: Number(entry.endRow || maxRows),
          startColumnIndex: entry.column - 1,
          endColumnIndex: entry.column,
          sheetId: sheetId,
        },
      },
    };
  });
}

async function ensurePublicReadPermission(accessToken, spreadsheetId) {
  const permissions = await googleApiJson(
    accessToken,
    "GET",
    "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(spreadsheetId) +
      "/permissions?fields=permissions(id,type,role)"
  );
  const existing = (permissions.permissions || []).some(function (permission) {
    return permission.type === "anyone" && permission.role === "reader";
  });

  if (existing) {
    return;
  }

  await googleApiJson(
    accessToken,
    "POST",
    "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(spreadsheetId) +
      "/permissions?sendNotificationEmail=false",
    {
      allowFileDiscovery: false,
      role: "reader",
      type: "anyone",
    }
  );
}

async function ensureBoundScriptProject(accessToken, config) {
  if (String(config.script.scriptId || "").trim()) {
    return;
  }

  const project = await googleApiJson(accessToken, "POST", "https://script.googleapis.com/v1/projects", {
    parentId: config.spreadsheetId,
    title: config.script.title,
  });

  config.script.scriptId = project.scriptId;
  await persistDemoSheetConfig(config);
}

async function syncBoundScriptWithClasp(config) {
  const source = await fsp.readFile(SCRIPT_SOURCE_PATH, "utf8");

  await ensureCommandExists("clasp");
  await fsp.mkdir(CLASP_WORKDIR, { recursive: true });
  await fsp.writeFile(
    path.join(CLASP_WORKDIR, ".clasp.json"),
    JSON.stringify(
      {
        rootDir: ".",
        scriptId: config.script.scriptId,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  await fsp.writeFile(path.join(CLASP_WORKDIR, "appsscript.json"), JSON.stringify(DEFAULT_MANIFEST, null, 2) + "\n");
  await fsp.writeFile(path.join(CLASP_WORKDIR, "hoodlefinance.js"), source, "utf8");
  await runCommand("clasp", ["push", "--force"], {
    cwd: CLASP_WORKDIR,
  });
}

async function ensureAccessToken() {
  const clientConfig = readJsonSync(OAUTH_CLIENT_PATH, "OAuth client config");
  const client = normalizeOAuthClient(clientConfig);
  const existingToken = readOptionalJsonSync(OAUTH_TOKEN_PATH);

  if (existingToken && !tokenExpired(existingToken)) {
    return existingToken.access_token;
  }

  if (existingToken && existingToken.refresh_token) {
    return (await refreshAccessToken(client, existingToken)).access_token;
  }

  return (await authorizeInteractively(client)).access_token;
}

function normalizeOAuthClient(rawConfig) {
  const client = rawConfig && (rawConfig.installed || rawConfig.web || rawConfig);

  if (!client || !client.client_id) {
    throw new Error("OAuth client JSON must contain an installed or web client with client_id.");
  }

  return {
    clientId: client.client_id,
    clientSecret: client.client_secret || "",
  };
}

function tokenExpired(token) {
  const expiry = Number(token && token.expiry_date ? token.expiry_date : 0);
  return !token || !token.access_token || (expiry && expiry <= Date.now() + 60 * 1000);
}

async function refreshAccessToken(client, token) {
  const refreshed = await exchangeToken("refresh_token", {
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });

  refreshed.refresh_token = refreshed.refresh_token || token.refresh_token;
  await saveJson(OAUTH_TOKEN_PATH, refreshed);
  return refreshed;
}

async function authorizeInteractively(client) {
  const state = crypto.randomBytes(16).toString("hex");
  const server = http.createServer();
  const codePromise = new Promise(function (resolve, reject) {
    const timeout = setTimeout(function () {
      reject(new Error("Timed out waiting for OAuth callback."));
    }, 5 * 60 * 1000);

    server.on("request", function (request, response) {
      const url = new URL(request.url, "http://localhost");
      const returnedState = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      const error = url.searchParams.get("error") || "";

      if (error) {
        clearTimeout(timeout);
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Authorization failed: " + error + "\n");
        reject(new Error("OAuth authorization failed: " + error));
        return;
      }

      if (returnedState !== state || !code) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid OAuth callback.\n");
        return;
      }

      clearTimeout(timeout);
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Authorization received. You can close this tab.\n");
      resolve(code);
    });
  });

  await new Promise(function (resolve) {
    server.listen(0, "localhost", resolve);
  });

  try {
    const port = server.address().port;
    const redirectUri = "http://localhost:" + port + "/oauth2callback";
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        access_type: "offline",
        client_id: client.clientId,
        prompt: "consent",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GOOGLE_SCOPES.join(" "),
        state: state,
      }).toString();

    process.stdout.write(
      "Open this URL in a browser to authorize demo-sheet automation:\n" + authUrl + "\n\n"
    );

    const code = await codePromise;
    const token = await exchangeToken("authorization_code", {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    await saveJson(OAUTH_TOKEN_PATH, token);
    return token;
  } finally {
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
}

async function exchangeToken(label, params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams(params),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      "OAuth token exchange failed for " +
        label +
        ": " +
        JSON.stringify(payload && payload.error ? payload : { error: response.statusText })
    );
  }

  payload.expiry_date = Date.now() + Number(payload.expires_in || 0) * 1000;
  return payload;
}

async function googleApiJson(accessToken, method, url, body) {
  const headers = {
    Accept: "application/json",
    Authorization: "Bearer " + accessToken,
  };
  const request = {
    headers: headers,
    method: method,
  };
  let response;
  let text;

  if (body != null) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    request.body = JSON.stringify(body);
  }

  response = await fetch(url, request);
  text = await response.text();

  if (!response.ok) {
    throw new Error("Google API request failed (" + response.status + " " + response.statusText + "): " + text);
  }

  return text ? JSON.parse(text) : {};
}

function parseTsv(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const rows = [];
  let lastLineIndex = lines.length - 1;
  let i;

  while (lastLineIndex >= 0 && lines[lastLineIndex] === "") {
    lastLineIndex -= 1;
  }

  for (i = 0; i <= lastLineIndex; i += 1) {
    rows.push(lines[i].split("\t"));
  }

  return rows.length ? rows : [[""]];
}

function renderDemoReadmeBlock(publicUrl) {
  if (publicUrl) {
    return (
      DEMO_MARKER_START +
      "\nSee the [public demo sheet](" +
      publicUrl +
      ") for live examples. The managed tab data lives in [`docs/demo-sheet/`](./docs/demo-sheet/).\n" +
      DEMO_MARKER_END
    );
  }

  return (
    DEMO_MARKER_START +
    "\nThe public demo sheet will be linked here after it is created with `node tools/sync-demo-sheet.js`. The managed tab data lives in [`docs/demo-sheet/`](./docs/demo-sheet/).\n" +
      DEMO_MARKER_END
  );
}

function replaceDemoReadmeBlock(readmeText, publicUrl) {
  const replacement = renderDemoReadmeBlock(publicUrl);
  const pattern = new RegExp(
    escapeRegex(DEMO_MARKER_START) + "[\\s\\S]*?" + escapeRegex(DEMO_MARKER_END)
  );

  if (pattern.test(readmeText)) {
    return readmeText.replace(pattern, replacement);
  }

  return readmeText.replace("## Quick Start", "## Live Demo\n\n" + replacement + "\n\n## Quick Start");
}

async function updateReadmeDemoLink(publicUrl) {
  const existing = await fsp.readFile(README_PATH, "utf8");
  const updated = replaceDemoReadmeBlock(existing, publicUrl);

  if (updated !== existing) {
    await fsp.writeFile(README_PATH, updated, "utf8");
  }
}

function buildSheetRange(sheetTitle, a1Range) {
  return "'" + String(sheetTitle).replace(/'/g, "''") + "'!" + a1Range;
}

function buildSpreadsheetUrl(spreadsheetId) {
  return "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit?usp=sharing";
}

function resolveRepoPath(relativePath) {
  return path.resolve(ROOT_DIR, relativePath);
}

function readJsonSync(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error("Unable to read " + label + " at " + path.relative(ROOT_DIR, filePath) + ": " + error.message);
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

async function saveJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function persistDemoSheetConfig(config) {
  await saveJson(CONFIG_PATH, config);
}

async function ensureCommandExists(command) {
  try {
    await runCommand(command, ["--version"]);
  } catch (error) {
    throw new Error(
      "Required command \"" +
        command +
        "\" is not available. Install it and authenticate it before running this sync.\n" +
        error.message
    );
  }
}

function runCommand(command, args, options) {
  return new Promise(function (resolve, reject) {
    const child = spawn(command, args, {
      cwd: options && options.cwd ? options.cwd : ROOT_DIR,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

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
            command +
              " " +
              args.join(" ") +
              " failed with exit code " +
              code +
              ".\n" +
              (stderr || stdout || "").trim()
          )
        );
        return;
      }
      resolve({
        stderr: stderr,
        stdout: stdout,
      });
    });
  });
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printSummary(config, options, message) {
  process.stdout.write(message + "\n");
  process.stdout.write("Spreadsheet ID: " + (config.spreadsheetId || "<not created yet>") + "\n");
  process.stdout.write("Public URL: " + (config.publicUrl || "<not created yet>") + "\n");
  process.stdout.write("Script ID: " + (config.script && config.script.scriptId ? config.script.scriptId : "<not created yet>") + "\n");
  process.stdout.write(
    "Mode: " +
      (options.dryRun ? "dry-run" : "live") +
      (options.skipClasp ? ", skip-clasp" : "") +
      (options.skipSharing ? ", skip-sharing" : "") +
      "\n"
  );
}

module.exports = {
  CONFIG_PATH,
  OAUTH_CLIENT_PATH,
  OAUTH_TOKEN_PATH,
  buildAutoResizeColumnsRequest,
  buildBodyAlignmentRequest,
  buildCalloutRowFormatRequest,
  buildColumnWidthRequests,
  buildFormulaCellFormatRequests,
  buildFreezeRowsRequest,
  buildFormulaColumnFormatRequest,
  buildFormulaRowFormatRequest,
  buildHeaderRowFormatRequest,
  buildMergeCellsRequest,
  buildNumberFormatRequests,
  buildSheetRange,
  buildSpreadsheetUrl,
  buildUnmergeCellsRequest,
  loadDemoSheetConfig,
  normalizeTabFormatting,
  parseArgs,
  parseTsv,
  renderDemoReadmeBlock,
  replaceDemoReadmeBlock,
  resolveRepoPath,
  validateConfig,
};

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
    process.exitCode = 1;
  });
}
