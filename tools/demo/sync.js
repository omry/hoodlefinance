#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { buildPathRows, buildStatusRow, printBundleFiles, printContextBlock } = require("../cli-reporting.js");
const {
  getClaspCommand,
  getClaspAuth,
} = require("../clasp-auth.js");
const {
  DEFAULT_STYLES,
  buildFormulaCellFormatRequests,
  buildResolvedStyleApplications,
  buildStyleApplicationRequests,
  buildStyleRepeatCellRequest,
  normalizeStyleRegistry,
} = require("./styles.js");
const {
  copyRgbColor,
  normalizeTabFormatting,
  validateConfig,
} = require("./config.js");
const {
  ensureAccessTokenWithDeps,
  googleApiJson,
  isInvalidGrantOAuthError,
} = require("./google.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DEMO_DIR = path.join(ROOT_DIR, "docs", "demo-sheet");
const CONFIG_PATH = path.join(DEMO_DIR, "demo-sheet.json");
const STAGING_CONFIG_PATH = path.join(DEMO_DIR, "demo-sheet-staging.json");
const README_PATH = path.join(ROOT_DIR, "README.md");
const WEBSITE_INTRO_PATH = path.join(ROOT_DIR, "website", "docs", "intro.md");
const WEBSITE_INDEX_PATH = path.join(ROOT_DIR, "website", "src", "pages", "index.js");
const SCRIPT_SOURCE_PATH = path.join(ROOT_DIR, "hoodlefinance.js");
const LOCAL_DIR = path.join(ROOT_DIR, ".demo-sheet.local");
const OAUTH_CLIENT_PATH_ENV_VAR = "DEMO_SHEET_OAUTH_CLIENT_PATH";
const OAUTH_TOKEN_PATH_ENV_VAR = "DEMO_SHEET_OAUTH_TOKEN_PATH";
const OAUTH_TOKEN_READ_ONLY_ENV_VAR = "HOODLEFINANCE_DEMO_OAUTH_TOKEN_READ_ONLY";
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
  "https://www.googleapis.com/auth/userinfo.email",
];
const DEFAULT_ERROR_TEXT_COLOR = {
  red: 0.8,
  green: 0.2,
  blue: 0.2,
};

async function main() {
  const rawArgv = process.argv.slice(2);
  assertNoLikelyMissingNpmArgSeparator(rawArgv, process.env, "demo:sync");
  const options = parseArgs(rawArgv);
  const config = loadDemoSheetConfig(options.production);
  const claspAuth = getClaspAuth(getDemoClaspAuthPath(options.production));
  const claspAuthPath = getClaspAuthPath(claspAuth);
  let claspUser = "";

  if (!options.skipClasp && !process.env.HOODLEFINANCE_NON_INTERACTIVE) {
    if (claspAuthPath && !fs.existsSync(claspAuthPath)) {
      claspUser = "(Not logged in)";
    } else {
      try {
        const output = await runCommand(getClaspCommand(ROOT_DIR), claspAuth.authArgs.concat(["show-authorized-user"]));
        claspUser = parseClaspUserIdentity(String((output && (output.stdout || output.stderr)) || "")) || "(Logged in)";
      } catch (error) {
        // Ignore if not logged in; push will fail distinctly anyway
      }
    }
  }

  validateConfig(config);
  await ensureConfiguredTabFilesExist(config);

  if (options.dryRun) {
    await printDemoCredentialContext(options.production, {
      claspUser: claspUser,
      dryRun: true,
    });
    printSummary(config, options, "Dry run completed. No network or clasp operations were performed.", claspAuth.authSource, claspUser);
    return;
  }

  const accessToken = await ensureAccessToken(options.production);
  await printDemoCredentialContext(options.production, {
    accessToken: accessToken,
    claspUser: claspUser,
  });
  const syncedConfig = await syncDemoSheet(accessToken, config, options, claspAuth);

  await persistRuntimeDemoConfig(syncedConfig, options.production);

  if (options.production) {
    await updateDemoLinks(syncedConfig.publicUrl || "");
  }
  
  printSummary(syncedConfig, options, "Demo sheet sync completed.", claspAuth.authSource, claspUser);
}

function assertNoLikelyMissingNpmArgSeparator(argv, env, scriptName) {
  const normalizedArgv = Array.isArray(argv) ? argv : [];
  const normalizedEnv = env || process.env;

  if (
    String(normalizedEnv.npm_config_dry_run || "").trim() === "true" &&
    normalizedArgv.indexOf("--dry-run") === -1
  ) {
    throw new Error(
      "It looks like `--dry-run` was passed to `npm run` without the required `--` separator.\n" +
        "Use `npm run " + scriptName + " -- --dry-run`, `npm run " + scriptName + " -- --production --dry-run`, or a dedicated script such as `npm run " + scriptName + ":production:dry-run`."
    );
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    production: false,
    skipClasp: false,
    skipSharing: false,
  };
  let i;
  let targetName = "";

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

    if (argv[i] === "--production" || argv[i] === "--live-demo") {
      if (targetName && targetName !== "production") {
        throw new Error("Choose exactly one demo target: --staging or --production.");
      }
      options.production = true;
      targetName = "production";
      continue;
    }

    if (argv[i] === "--staging") {
      if (targetName && targetName !== "staging") {
        throw new Error("Choose exactly one demo target: --staging or --production.");
      }
      options.production = false;
      targetName = "staging";
      continue;
    }

    throw new Error("Unknown argument: " + argv[i]);
  }

  if (!targetName) {
    throw new Error("Choose a demo target: --staging or --production.");
  }

  return options;
}

function loadDemoSheetConfig(isProduction) {
  const baseConfig = readJsonSync(CONFIG_PATH, "demo-sheet config");
  
  if (isProduction) {
    return baseConfig;
  }
  
  const stagingConfig = readOptionalJsonSync(STAGING_CONFIG_PATH) || {};
  const osUsername = String(process.env.USER || process.env.USERNAME || os.userInfo().username || "Dev");
  const stagingTitle = stagingConfig.title || baseConfig.title + " (Staging - " + osUsername + ")";
  const scriptTitle = (stagingConfig.script && stagingConfig.script.title) || (baseConfig.script && baseConfig.script.title) + " (Staging - " + osUsername + ")";
  
  // Merge staging overrides onto base config
  return Object.assign({}, baseConfig, stagingConfig, {
    // Ensure we don't accidentally inherit production IDs if staging config was empty
    spreadsheetId: stagingConfig.spreadsheetId || "",
    publicUrl: stagingConfig.publicUrl || "",
    sharePublicReadOnly:
      typeof stagingConfig.sharePublicReadOnly === "boolean"
        ? stagingConfig.sharePublicReadOnly
        : baseConfig.sharePublicReadOnly === true,
    title: stagingTitle,
    script: Object.assign({}, baseConfig.script, stagingConfig.script, {
      scriptId: (stagingConfig.script && stagingConfig.script.scriptId) || "",
      title: scriptTitle
    })
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

async function syncDemoSheet(accessToken, inputConfig, options, claspAuth) {
  const config = JSON.parse(JSON.stringify(inputConfig));
  let sheetMap;

  await ensureSpreadsheet(accessToken, config, options);
  await ensureTabs(accessToken, config);
  sheetMap = await fetchSpreadsheetSheetMap(accessToken, config.spreadsheetId);
  await resetTabFormatsBeforeWrite(accessToken, config, sheetMap);
  await writeTabs(accessToken, config);
  await applyTabFormatting(accessToken, config, sheetMap);

  await ensureBoundScriptProject(accessToken, config, options);

  if (config.sharePublicReadOnly && !options.skipSharing) {
    await ensurePublicReadPermission(accessToken, config.spreadsheetId);
  }

  if (!options.skipClasp) {
    await syncBoundScriptWithClasp(config, options, claspAuth);
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
    requests.push(buildUnmergeSheetRequest(sheetProperties.sheetId, sheetRowCount, sheetColumnCount));
    requests.push.apply(
      requests,
      buildDeleteConditionalFormatRuleRequests(sheetProperties.sheetId, Number(sheetProperties.conditionalFormatCount || 0))
    );
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

async function ensureSpreadsheet(accessToken, config, options) {
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
  await persistRuntimeDemoConfig(config, options && options.production);
}

async function ensureTabs(accessToken, config) {
  let sheetMap = await fetchSpreadsheetSheetMap(accessToken, config.spreadsheetId);
  let requests = buildEnsureTabsRequests(sheetMap, config);

  if (requests.length) {
    await googleApiJson(
      accessToken,
      "POST",
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        encodeURIComponent(config.spreadsheetId) +
        ":batchUpdate",
      { requests: requests }
    );

    sheetMap = await fetchSpreadsheetSheetMap(accessToken, config.spreadsheetId);
  }

  requests = buildReorderTabsRequests(sheetMap, config);

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

function buildEnsureTabsRequests(sheetMap, config) {
  const existingByTitle = {};
  const managedByTitle = {};
  const requests = [];
  let i;
  let title;
  let sheetProperties;

  Object.keys(sheetMap || {}).forEach(function (sheetTitle) {
    existingByTitle[sheetTitle] = true;
  });

  for (i = 0; i < config.tabs.length; i += 1) {
    title = config.tabs[i].title;
    managedByTitle[title] = true;

    if (!existingByTitle[title]) {
      requests.push({
        addSheet: {
          properties: {
            title: title,
          },
        },
      });
    }
  }

  Object.keys(sheetMap || {}).forEach(function (sheetTitle) {
    sheetProperties = sheetMap[sheetTitle];

    if (managedByTitle[sheetTitle]) {
      return;
    }

    if (!sheetProperties || !Number.isInteger(sheetProperties.sheetId)) {
      return;
    }

    requests.push({
      deleteSheet: {
        sheetId: sheetProperties.sheetId,
      },
    });
  });

  return requests;
}

function buildReorderTabsRequests(sheetMap, config) {
  const requests = [];
  let i;
  let title;
  let sheetProperties;

  for (i = 0; i < config.tabs.length; i += 1) {
    title = config.tabs[i].title;
    sheetProperties = sheetMap[title];

    if (!sheetProperties || !Number.isInteger(sheetProperties.sheetId)) {
      continue;
    }

    if (sheetProperties.index === i) {
      continue;
    }

    requests.push({
      updateSheetProperties: {
        fields: "index",
        properties: {
          index: i,
          sheetId: sheetProperties.sheetId,
        },
      },
    });
  }

  return requests;
}

async function fetchSpreadsheetSheetMap(accessToken, spreadsheetId) {
  const response = await googleApiJson(
    accessToken,
    "GET",
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(spreadsheetId) +
      "?fields=sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)),conditionalFormats)"
  );
  const sheetMap = {};

  (response.sheets || []).forEach(function (sheet) {
    const properties = sheet && sheet.properties ? sheet.properties : null;
    const title = properties && properties.title ? properties.title : "";

    if (title) {
      properties.conditionalFormatCount = Array.isArray(sheet.conditionalFormats) ? sheet.conditionalFormats.length : 0;
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
  const styleRegistry = normalizeStyleRegistry(config.styles);
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

    if (values.length > 0 && sheetColumnCount > 0) {
      // Clear stale merges left behind by earlier sheet layouts before applying current merges.
      requests.push(buildUnmergeSheetRequest(sheetProperties.sheetId, sheetRowCount, sheetColumnCount));
    }

    formatting.mergedRanges.forEach(function (range) {
      requests.push(buildMergeCellsRequest(sheetProperties.sheetId, range));
    });

    requests.push.apply(
      requests,
      buildColumnBackgroundRequests(sheetProperties.sheetId, formatting.columnBackgrounds, values.length)
    );
    requests.push.apply(
      requests,
      buildStyleApplicationRequests(
        sheetProperties.sheetId,
        styleRegistry,
        buildResolvedStyleApplications(formatting),
        {
          values: values,
          maxColumns: maxColumns,
          sheetColumnCount: sheetColumnCount,
          sheetRowCount: sheetRowCount,
        }
      )
    );
    requests.push.apply(requests, buildNumberFormatRequests(sheetProperties.sheetId, formatting.numberFormats));

    if (sheetRowCount > 0 && sheetColumnCount > 0) {
      requests.push(buildSheetErrorConditionalFormatRequest(sheetProperties.sheetId, sheetRowCount, sheetColumnCount));
    }

    requests.push.apply(
      requests,
      buildErrorConditionalFormatRequests(sheetProperties.sheetId, formatting.errorConditionalFormats, 1)
    );

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

function buildUnmergeSheetRequest(sheetId, rowCount, columnCount) {
  return {
    unmergeCells: {
      range: {
        startRowIndex: 0,
        endRowIndex: rowCount,
        startColumnIndex: 0,
        endColumnIndex: columnCount,
        sheetId: sheetId,
      },
    },
  };
}

function buildBodyAlignmentRequest(sheetId, maxRows, maxColumns) {
  return buildStyleRepeatCellRequest(sheetId, DEFAULT_STYLES.sheetBody, {
    startRowIndex: 0,
    endRowIndex: maxRows,
    startColumnIndex: 0,
    endColumnIndex: maxColumns,
  });
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
            backgroundColor: copyRgbColor(entry.backgroundColor),
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

function buildDeleteConditionalFormatRuleRequests(sheetId, count) {
  const requests = [];
  let index;

  for (index = count - 1; index >= 0; index -= 1) {
    requests.push({
      deleteConditionalFormatRule: {
        index: index,
        sheetId: sheetId,
      },
    });
  }

  return requests;
}

function buildSheetErrorConditionalFormatRequest(sheetId, maxRows, maxColumns) {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        booleanRule: {
          condition: {
            type: "CUSTOM_FORMULA",
            values: [
              {
                userEnteredValue: "=ISERROR(A1)",
              },
            ],
          },
          format: {
            textFormat: {
              bold: true,
              foregroundColor: copyRgbColor(DEFAULT_ERROR_TEXT_COLOR),
            },
          },
        },
        ranges: [
          {
            startRowIndex: 0,
            endRowIndex: maxRows,
            startColumnIndex: 0,
            endColumnIndex: maxColumns,
            sheetId: sheetId,
          },
        ],
      },
    },
  };
}

function buildErrorConditionalFormatRequests(sheetId, entries, startIndex) {
  const baseIndex = Number.isInteger(startIndex) ? startIndex : 0;

  return entries.map(function (entry, index) {
    return {
      addConditionalFormatRule: {
        index: baseIndex + index,
        rule: {
          booleanRule: {
            condition: {
              type: "CUSTOM_FORMULA",
              values: [
                {
                  userEnteredValue: "=ISERROR(" + buildA1Reference_(entry.startColumn, entry.startRow) + ")",
                },
              ],
            },
            format: {
              textFormat: {
                bold: true,
                foregroundColor: copyRgbColor(DEFAULT_ERROR_TEXT_COLOR),
              },
            },
          },
          ranges: [
            {
              startRowIndex: entry.startRow - 1,
              endRowIndex: entry.endRow,
              startColumnIndex: entry.startColumn - 1,
              endColumnIndex: entry.endColumn,
              sheetId: sheetId,
            },
          ],
        },
      },
    };
  });
}

function buildA1Reference_(columnNumber, rowNumber) {
  let value = Number(columnNumber);
  let letters = "";

  while (value > 0) {
    letters = String.fromCharCode(65 + ((value - 1) % 26)) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters + String(rowNumber);
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

async function ensureBoundScriptProject(accessToken, config, options) {
  if (String(config.script.scriptId || "").trim()) {
    return;
  }

  const project = await googleApiJson(accessToken, "POST", "https://script.googleapis.com/v1/projects", {
    parentId: config.spreadsheetId,
    title: config.script.title,
  });

  config.script.scriptId = project.scriptId;
  await persistRuntimeDemoConfig(config, options && options.production);
}

async function syncBoundScriptWithClasp(config, options, claspAuth) {
  let source = await fsp.readFile(SCRIPT_SOURCE_PATH, "utf8");
  const claspCommand = getClaspCommand(ROOT_DIR);
  const claspWorkDir = getDemoClaspWorkDir(options.production);
  const claspProjectPath = path.join(claspWorkDir, ".clasp.json");
  const claspAuthPath = getClaspAuthPath(claspAuth);

  if (!options.production) {
    const d = new Date();
    const offset = -d.getTimezoneOffset();
    const pad = function (n) { return String(n).padStart(2, "0"); };
    const localIso = new Date(d.getTime() + offset * 60000).toISOString();
    const timestamp = localIso.replace("T", "_").replace(/:/g, "-").slice(0, 19) +
      (offset >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(offset) / 60)) + pad(Math.abs(offset) % 60);

    source = source.replace(
      /const HOODLEFINANCE_VERSION_ = "([^"]+)";/,
      "const HOODLEFINANCE_VERSION_ = \"$1-dev-" + timestamp + "\";"
    );
  }

  await ensureCommandExists(claspCommand);
  await fsp.mkdir(claspWorkDir, { recursive: true });
  await fsp.writeFile(
    claspProjectPath,
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
  await fsp.writeFile(path.join(claspWorkDir, "appsscript.json"), JSON.stringify(DEFAULT_MANIFEST, null, 2) + "\n");
  await fsp.writeFile(path.join(claspWorkDir, "hoodlefinance.js"), source, "utf8");
  printClaspPushContext({
    claspAuthPath: claspAuthPath,
    claspProjectPath: claspProjectPath,
    isProduction: options.production,
    scriptId: config.script.scriptId,
    spreadsheetId: config.spreadsheetId,
    workDir: claspWorkDir,
  });
  try {
    await runCommand(claspCommand, claspAuth.authArgs.concat(["-P", claspProjectPath, "push", "--force"]), {
      cwd: claspWorkDir,
    });
  } catch (error) {
    throw explainClaspPushFailure(error, {
      claspAuthPath: claspAuthPath,
      claspProjectPath: claspProjectPath,
      command: claspCommand,
      isProduction: options.production,
      scriptId: config.script.scriptId,
      spreadsheetId: config.spreadsheetId,
      workDir: claspWorkDir,
    });
  }
}


async function ensureAccessToken(isProduction) {
  return ensureAccessTokenWithDeps({
    nonInteractive: process.env.CI === "true" || process.env.HOODLEFINANCE_NON_INTERACTIVE === "1",
    oauthClientPath: getDemoOauthClientPath(isProduction),
    oauthTokenPath: getDemoOauthTokenPath(isProduction),
    readJsonSync: readJsonSync,
    readOptionalJsonSync: readOptionalJsonSync,
    saveJson: saveDemoOauthTokenJson,
    scopes: GOOGLE_SCOPES,
  });
}

async function printDemoCredentialContext(isProduction, info) {
  const normalizedInfo = info || {};
  const clientPath = getDemoOauthClientPath(isProduction);
  const tokenPath = getDemoOauthTokenPath(isProduction);
  const rows = buildPathRows([
    { label: "OAuth Client config", path: clientPath },
    { label: "OAuth Token cache", path: tokenPath },
  ], {
    prefixStatusIconOnLabel: true,
  });
  rows.push(buildStatusRow({
    label: "Target Demo Mode",
    level: isProduction ? "ATTENTION" : "OK",
    value: isProduction ? "Production Public Demo" : "Local Staging",
  }));

  if (normalizedInfo.accessToken) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + normalizedInfo.accessToken);
      const tokenInfo = await res.json();
      if (tokenInfo.email) {
        rows.push(buildStatusRow({
          label: "OAuth Token Identity",
          level: "OK",
          value: sanitizeIdentity(tokenInfo.email),
        }));
      } else {
        rows.push(buildStatusRow({
          label: "OAuth Token Identity",
          level: "ERROR",
          value: "(Email unknown - scope not previously requested. Delete " + tokenPath + " to re-prompt for email)",
        }));
      }
    } catch (err) {
      rows.push(buildStatusRow({
        label: "OAuth Token Identity",
        level: "ERROR",
        value: "(Failed to fetch tokeninfo)",
      }));
    }
  } else if (normalizedInfo.claspUser) {
    rows.push(buildStatusRow({
      label: "Clasp Auth Identity",
      level: getClaspIdentityLevel(normalizedInfo.claspUser),
      value: normalizedInfo.claspUser,
    }));
  } else if (normalizedInfo.dryRun) {
    rows.push(buildStatusRow({
      label: "Clasp Auth Identity",
      level: "ERROR",
      value: "(Not checked during dry run)",
    }));
  }

  printContextBlock("OAuth Credentials Context", rows, process.stdout, { trailingBlankLine: true });
}

function sanitizeIdentity(value) {
  return String(value || "").replace(/[.,;:]+$/, "");
}

function parseClaspUserIdentity(outputText) {
  const normalizedOutput = String(outputText || "").trim();
  const emailMatch = normalizedOutput.match(/([^ ]+@[^ ]+\.[^ \r\n]+)/);

  if (emailMatch) {
    return sanitizeIdentity(emailMatch[1]);
  }

  if (/unknown user/i.test(normalizedOutput)) {
    return "(Unknown user)";
  }

  if (/not logged in/i.test(normalizedOutput)) {
    return "(Not logged in)";
  }

  if (normalizedOutput) {
    return normalizedOutput.split(/\r?\n/)[0];
  }

  return "";
}

function getClaspIdentityLevel(identity) {
  if (!String(identity || "").trim()) {
    return "ERROR";
  }

  if (String(identity).trim() === "(Not logged in)") {
    return "ERROR";
  }

  if (/^\(.*\)$/.test(String(identity).trim())) {
    return "UNKNOWN";
  }

  return "OK";
}

function getClaspAuthPath(claspAuth) {
  const authArgs = claspAuth && Array.isArray(claspAuth.authArgs) ? claspAuth.authArgs : [];
  const authFlagIndex = authArgs.indexOf("-A");

  if (authFlagIndex === -1 || authFlagIndex + 1 >= authArgs.length) {
    return "";
  }

  return String(authArgs[authFlagIndex + 1] || "").trim();
}

function printClaspPushContext(context) {
  const normalizedContext = context || {};
  const rows = buildPathRows([
    { label: "Clasp Auth config", path: normalizedContext.claspAuthPath || "" },
    { label: "Clasp Project config", path: normalizedContext.claspProjectPath || "" },
  ], {
    prefixStatusIconOnLabel: true,
  });

  rows.push(buildStatusRow({
    label: "Target Demo Mode",
    level: normalizedContext.isProduction ? "ATTENTION" : "OK",
    value: normalizedContext.isProduction ? "Production Public Demo" : "Local Staging",
  }));
  rows.push(buildStatusRow({
    label: "Spreadsheet ID",
    level: normalizedContext.spreadsheetId ? "OK" : "ERROR",
    value: normalizedContext.spreadsheetId || "<not set>",
  }));
  rows.push(buildStatusRow({
    label: "Script ID",
    level: normalizedContext.scriptId ? "OK" : "ERROR",
    value: normalizedContext.scriptId || "<not set>",
  }));
  rows.push(buildStatusRow({
    label: "Work Dir",
    level: normalizedContext.workDir ? "OK" : "UNKNOWN",
    value: normalizedContext.workDir || "<unknown>",
  }));

  printContextBlock("Clasp Push Context", rows, process.stdout, { trailingBlankLine: true });
}

function explainClaspPushFailure(error, context) {
  const normalizedContext = context || {};
  const output = String(
    (error && (error.stderr || error.stdout || error.message)) || ""
  ).trim();

  return new Error(
    "Failed to push the demo bound script with clasp.\n" +
      "Mode: " + (normalizedContext.isProduction ? "production" : "staging") + "\n" +
      "Clasp auth file: " + (normalizedContext.claspAuthPath || "<unknown>") + "\n" +
      "Clasp project file: " + (normalizedContext.claspProjectPath || "<unknown>") + "\n" +
      "Work dir: " + (normalizedContext.workDir || "<unknown>") + "\n" +
      "Spreadsheet ID: " + (normalizedContext.spreadsheetId || "<not set>") + "\n" +
      "Script ID: " + (normalizedContext.scriptId || "<not set>") + "\n" +
      "Command: " + String(normalizedContext.command || "clasp") + " -A <auth> -P <project> push --force\n" +
      "Command output:\n" +
      (output || "(no stdout/stderr captured)")
  );
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
    "\nThe public demo sheet will be linked here after it is created with `npm run demo:sync:production`. The managed tab data lives in [`docs/demo-sheet/`](./docs/demo-sheet/).\n" +
      DEMO_MARKER_END
  );
}

function renderDemoIntroBlock(publicUrl) {
  if (publicUrl) {
    return (
      DEMO_MARKER_START +
      "\nSee the [public demo sheet](" +
      publicUrl +
      ") for more live examples.\n" +
      DEMO_MARKER_END
    );
  }

  return (
    DEMO_MARKER_START +
    "\nThe public demo sheet will be linked here after it is created.\n" +
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

function replaceDemoIntroBlock(introText, publicUrl) {
  const replacement = renderDemoIntroBlock(publicUrl);
  const pattern = new RegExp(
    escapeRegex(DEMO_MARKER_START) + "[\\s\\S]*?" + escapeRegex(DEMO_MARKER_END)
  );

  if (pattern.test(introText)) {
    return introText.replace(pattern, replacement);
  }

  return introText.replace(
    "Bare tickers such as `GOOG` are often the easiest place to start.",
    replacement + "\n\nBare tickers such as `GOOG` are often the easiest place to start."
  );
}

async function updateDemoLinks(publicUrl) {
  const existing = await fsp.readFile(README_PATH, "utf8");
  const updated = replaceDemoReadmeBlock(existing, publicUrl);
  const existingIntro = await fsp.readFile(WEBSITE_INTRO_PATH, "utf8");
  const updatedIntro = replaceDemoIntroBlock(existingIntro, publicUrl);
  const existingIndex = await fsp.readFile(WEBSITE_INDEX_PATH, "utf8");
  const updatedIndex = existingIndex.replace(
    /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit\?usp=sharing"/g,
    'href="' + publicUrl + '"'
  );

  if (updated !== existing) {
    await fsp.writeFile(README_PATH, updated, "utf8");
  }

  if (updatedIntro !== existingIntro) {
    await fsp.writeFile(WEBSITE_INTRO_PATH, updatedIntro, "utf8");
  }

  if (updatedIndex !== existingIndex) {
    await fsp.writeFile(WEBSITE_INDEX_PATH, updatedIndex, "utf8");
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

function resolvePreferredLocalPath(primaryPath, legacyPath) {
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  if (legacyPath && fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return primaryPath;
}

function getDemoProductionDir() {
  return path.join(LOCAL_DIR, "production");
}

function getDemoStagingDir() {
  return path.join(LOCAL_DIR, "staging");
}

function getDemoLegacyProductionDir() {
  return path.join(LOCAL_DIR, "live-demo");
}

function getDemoClaspAuthPath(isProduction) {
  if (!isProduction) {
    return path.join(getDemoStagingDir(), ".clasprc.json");
  }

  return resolvePreferredLocalPath(
    path.join(getDemoProductionDir(), ".clasprc.json"),
    path.join(getDemoLegacyProductionDir(), ".clasprc.json")
  );
}

function getDemoClaspWorkDir(isProduction) {
  return path.join(isProduction ? getDemoProductionDir() : getDemoStagingDir(), "clasp-work");
}

function getDemoBundleFiles() {
  return ["appsscript.json", "hoodlefinance.js"];
}

function getDemoOauthClientPath(isProduction) {
  if (String(process.env[OAUTH_CLIENT_PATH_ENV_VAR] || "").trim()) {
    return String(process.env[OAUTH_CLIENT_PATH_ENV_VAR] || "").trim();
  }

  if (!isProduction) {
    return path.join(getDemoStagingDir(), "oauth-client.json");
  }

  return resolvePreferredLocalPath(
    path.join(getDemoProductionDir(), "oauth-client.json"),
    path.join(getDemoLegacyProductionDir(), "oauth-client.json")
  );
}

function getDemoOauthTokenPath(isProduction) {
  if (String(process.env[OAUTH_TOKEN_PATH_ENV_VAR] || "").trim()) {
    return String(process.env[OAUTH_TOKEN_PATH_ENV_VAR] || "").trim();
  }

  if (!isProduction) {
    return path.join(getDemoStagingDir(), "oauth-token.json");
  }

  return resolvePreferredLocalPath(
    path.join(getDemoProductionDir(), "oauth-token.json"),
    path.join(getDemoLegacyProductionDir(), "oauth-token.json")
  );
}

async function saveDemoOauthTokenJson(filePath, value) {
  if (String(process.env[OAUTH_TOKEN_READ_ONLY_ENV_VAR] || "").trim() === "1") {
    return;
  }

  await saveJson(filePath, value);
}

function buildStagingOverrideConfig(config) {
  return {
    title: config.title,
    spreadsheetId: config.spreadsheetId,
    publicUrl: config.publicUrl,
    sharePublicReadOnly: config.sharePublicReadOnly,
    script: config.script,
  };
}

async function persistRuntimeDemoConfig(config, isProduction) {
  if (isProduction) {
    await saveJson(CONFIG_PATH, config);
    return;
  }

  await saveJson(STAGING_CONFIG_PATH, buildStagingOverrideConfig(config));
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
    const env = options && options.env ? options.env : process.env;
    const child = spawn(command, args, {
      cwd: options && options.cwd ? options.cwd : ROOT_DIR,
      env: env,
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

function printSummary(config, options, message, claspAuthSource, claspUser) {
  process.stdout.write(message + "\n");
  process.stdout.write("Spreadsheet ID: " + (config.spreadsheetId || "<not created yet>") + "\n");
  process.stdout.write("Public URL: " + (config.publicUrl || "<not created yet>") + "\n");
  process.stdout.write("Script ID: " + (config.script && config.script.scriptId ? config.script.scriptId : "<not created yet>") + "\n");
  printBundleFiles(getDemoBundleFiles());
  if (claspAuthSource) {
    process.stdout.write("Clasp credentials: " + claspAuthSource + "\n");
    if (claspUser) {
      process.stdout.write("Google account: " + claspUser + "\n");
    }
  }
  process.stdout.write("Target: " + (options.production ? "production" : "staging") + "\n");
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
  STAGING_CONFIG_PATH,
  buildAutoResizeColumnsRequest,
  buildBodyAlignmentRequest,
  buildEnsureTabsRequests,
  buildStyleApplicationRequests,
  buildStyleRepeatCellRequest,
  buildReorderTabsRequests,
  buildDeleteConditionalFormatRuleRequests,
  buildColumnWidthRequests,
  buildErrorConditionalFormatRequests,
  buildSheetErrorConditionalFormatRequest,
  buildFormulaCellFormatRequests,
  buildFreezeRowsRequest,
  buildMergeCellsRequest,
  buildNumberFormatRequests,
  buildResolvedStyleApplications,
  buildSheetRange,
  buildSpreadsheetUrl,
  buildUnmergeCellsRequest,
  buildUnmergeSheetRequest,
  assertNoLikelyMissingNpmArgSeparator,
  explainClaspPushFailure,
  getClaspIdentityLevel,
  getDemoClaspAuthPath,
  getDemoBundleFiles,
  getDemoClaspWorkDir,
  loadDemoSheetConfig,
  normalizeStyleRegistry,
  normalizeTabFormatting,
  parseClaspUserIdentity,
  parseArgs,
  parseTsv,
  ensureAccessTokenWithDeps,
  isInvalidGrantOAuthError,
  renderDemoIntroBlock,
  renderDemoReadmeBlock,
  replaceDemoIntroBlock,
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
