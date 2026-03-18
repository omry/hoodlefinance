const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  CONFIG_PATH,
  buildAutoResizeColumnsRequest,
  buildBodyAlignmentRequest,
  buildCalloutRowFormatRequest,
  buildDeleteConditionalFormatRuleRequests,
  buildColumnWidthRequests,
  buildErrorConditionalFormatRequests,
  buildSheetErrorConditionalFormatRequest,
  buildFormulaCellFormatRequests,
  buildFreezeRowsRequest,
  buildFormulaColumnFormatRequest,
  buildFormulaRowFormatRequest,
  buildHeaderRowFormatRequest,
  buildMergeCellsRequest,
  buildUnmergeCellsRequest,
  buildNumberFormatRequests,
  buildSheetRange,
  ensureAccessTokenWithDeps,
  isInvalidGrantOAuthError,
  loadDemoSheetConfig,
  normalizeTabFormatting,
  parseArgs,
  parseTsv,
  renderDemoReadmeBlock,
  replaceDemoReadmeBlock,
  resolveRepoPath,
  validateConfig,
} = require("../tools/sync-demo-sheet.js");

test("parseArgs handles the supported flags", function () {
  assert.deepEqual(parseArgs([]), {
    dryRun: false,
    liveDemo: false,
    skipClasp: false,
    skipSharing: false,
  });
  assert.deepEqual(parseArgs(["--dry-run", "--skip-clasp", "--skip-sharing", "--live-demo"]), {
    dryRun: true,
    liveDemo: true,
    skipClasp: true,
    skipSharing: true,
  });
  assert.throws(function () {
    parseArgs(["--wat"]);
  }, /Unknown argument/);
});

test("ensureAccessTokenWithDeps returns a valid cached token without refreshing", async function () {
  const accessToken = await ensureAccessTokenWithDeps({
    authorizeInteractively: async function () {
      throw new Error("should not authorize");
    },
    readJsonSync: function () {
      return { installed: { client_id: "client-id", client_secret: "secret" } };
    },
    readOptionalJsonSync: function () {
      return {
        access_token: "cached-access",
        expiry_date: Date.now() + 10 * 60 * 1000,
      };
    },
    refreshAccessToken: async function () {
      throw new Error("should not refresh");
    },
  });

  assert.equal(accessToken, "cached-access");
});

test("ensureAccessTokenWithDeps refreshes an expired token when refresh succeeds", async function () {
  let refreshCalls = 0;
  const accessToken = await ensureAccessTokenWithDeps({
    authorizeInteractively: async function () {
      throw new Error("should not authorize");
    },
    readJsonSync: function () {
      return { installed: { client_id: "client-id", client_secret: "secret" } };
    },
    readOptionalJsonSync: function () {
      return {
        access_token: "expired-access",
        expiry_date: Date.now() - 1,
        refresh_token: "refresh-token",
      };
    },
    refreshAccessToken: async function () {
      refreshCalls += 1;
      return {
        access_token: "refreshed-access",
        expiry_date: Date.now() + 10 * 60 * 1000,
        refresh_token: "refresh-token",
      };
    },
  });

  assert.equal(accessToken, "refreshed-access");
  assert.equal(refreshCalls, 1);
});

test("ensureAccessTokenWithDeps falls back to interactive auth after invalid_grant", async function () {
  let authorized = 0;
  let stdout = "";
  const originalWrite = process.stdout.write;

  process.stdout.write = function (chunk) {
    stdout += String(chunk);
    return true;
  };

  try {
    const accessToken = await ensureAccessTokenWithDeps({
      authorizeInteractively: async function () {
        authorized += 1;
        return {
          access_token: "interactive-access",
          expiry_date: Date.now() + 10 * 60 * 1000,
          refresh_token: "new-refresh-token",
        };
      },
      readJsonSync: function () {
        return { installed: { client_id: "client-id", client_secret: "secret" } };
      },
      readOptionalJsonSync: function () {
        return {
          access_token: "expired-access",
          expiry_date: Date.now() - 1,
          refresh_token: "stale-refresh-token",
        };
      },
      refreshAccessToken: async function () {
        const error = new Error("invalid grant");
        error.oauthError = "invalid_grant";
        throw error;
      },
    });

    assert.equal(accessToken, "interactive-access");
    assert.equal(authorized, 1);
    assert.match(stdout, /Starting interactive reauthorization/);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test("ensureAccessTokenWithDeps rethrows non-invalid-grant refresh failures", async function () {
  await assert.rejects(
    ensureAccessTokenWithDeps({
      authorizeInteractively: async function () {
        throw new Error("should not authorize");
      },
      readJsonSync: function () {
        return { installed: { client_id: "client-id", client_secret: "secret" } };
      },
      readOptionalJsonSync: function () {
        return {
          access_token: "expired-access",
          expiry_date: Date.now() - 1,
          refresh_token: "refresh-token",
        };
      },
      refreshAccessToken: async function () {
        const error = new Error("access denied");
        error.oauthError = "access_denied";
        throw error;
      },
    }),
    /access denied/
  );
});

test("isInvalidGrantOAuthError only matches invalid_grant", function () {
  assert.equal(isInvalidGrantOAuthError({ oauthError: "invalid_grant" }), true);
  assert.equal(isInvalidGrantOAuthError({ oauthError: "access_denied" }), false);
  assert.equal(isInvalidGrantOAuthError(new Error("plain error")), false);
});

test("parseTsv preserves blank interior rows and strips only trailing newline rows", function () {
  assert.deepEqual(parseTsv("a\tb\n1\t2\n\n3\t4\n"), [
    ["a", "b"],
    ["1", "2"],
    [""],
    ["3", "4"],
  ]);
  assert.deepEqual(parseTsv(""), [[""]]);
});

test("buildSheetRange quotes sheet names for A1 notation", function () {
  assert.equal(buildSheetRange("Ticker Forms", "A1"), "'Ticker Forms'!A1");
  assert.equal(buildSheetRange("Bob's Tab", "A:ZZZ"), "'Bob''s Tab'!A:ZZZ");
});

test("formatting helpers build the expected Sheets API requests", function () {
  assert.deepEqual(buildFreezeRowsRequest(12, 1), {
    updateSheetProperties: {
      fields: "gridProperties.frozenRowCount",
      properties: {
        gridProperties: {
          frozenRowCount: 1,
        },
        sheetId: 12,
      },
    },
  });

  assert.deepEqual(buildAutoResizeColumnsRequest(12, 4), {
    autoResizeDimensions: {
      dimensions: {
        dimension: "COLUMNS",
        endIndex: 4,
        sheetId: 12,
        startIndex: 0,
      },
    },
  });

  assert.deepEqual(buildBodyAlignmentRequest(12, 3, 2), {
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            blue: 1,
            green: 1,
            red: 1,
          },
          backgroundColorStyle: {
            rgbColor: {
              blue: 1,
              green: 1,
              red: 1,
            },
          },
          horizontalAlignment: "LEFT",
          textFormat: {
            bold: false,
            italic: false,
          },
          wrapStrategy: "CLIP",
        },
      },
      fields: "userEnteredFormat",
      range: {
        endColumnIndex: 2,
        endRowIndex: 3,
        sheetId: 12,
        startColumnIndex: 0,
        startRowIndex: 0,
      },
    },
  });

  assert.equal(buildCalloutRowFormatRequest(12, 8, 5).repeatCell.range.startRowIndex, 7);
  assert.equal(buildMergeCellsRequest(12, {
    startRow: 8,
    endRow: 8,
    startColumn: 1,
    endColumn: 5,
  }).mergeCells.range.endColumnIndex, 5);
  assert.equal(buildUnmergeCellsRequest(12, {
    startRow: 8,
    endRow: 8,
    startColumn: 1,
    endColumn: 5,
  }).unmergeCells.range.startColumnIndex, 0);

  assert.deepEqual(normalizeTabFormatting({ headerRows: [1, 7] }), {
    autoResizeColumns: true,
    calloutRows: [],
    columnBackgrounds: [],
    columnPixelSizes: [],
    errorConditionalFormats: [],
    freezeRows: 0,
    formulaColumns: [],
    formulaSections: [],
    formulaRows: [],
    headerSections: [],
    headerRows: [1, 7],
    mergedRanges: [],
    numberFormats: [],
  });

  assert.deepEqual(normalizeTabFormatting({ headerSections: [{ row: 4, columns: 2 }] }).headerSections, [
    { row: 4, columns: 2 },
  ]);

  assert.equal(buildHeaderRowFormatRequest(12, 7, 3).repeatCell.range.startRowIndex, 6);
  assert.equal(buildColumnWidthRequests(12, [120, 240])[1].updateDimensionProperties.properties.pixelSize, 240);
  assert.deepEqual(buildDeleteConditionalFormatRuleRequests(12, 2), [
    {
      deleteConditionalFormatRule: {
        index: 1,
        sheetId: 12,
      },
    },
    {
      deleteConditionalFormatRule: {
        index: 0,
        sheetId: 12,
      },
    },
  ]);
  assert.deepEqual(buildSheetErrorConditionalFormatRequest(12, 1000, 5), {
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
            backgroundColor: {
              red: 1,
              green: 0.92,
              blue: 0.92,
            },
          },
        },
        ranges: [
          {
            startRowIndex: 0,
            endRowIndex: 1000,
            startColumnIndex: 0,
            endColumnIndex: 5,
            sheetId: 12,
          },
        ],
      },
    },
  });
  assert.deepEqual(buildErrorConditionalFormatRequests(12, [{
    startRow: 2,
    endRow: 1000,
    startColumn: 3,
    endColumn: 3,
    backgroundColor: {
      red: 1,
      green: 0.92,
      blue: 0.92,
    },
  }])[0], {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        booleanRule: {
          condition: {
            type: "CUSTOM_FORMULA",
            values: [
              {
                userEnteredValue: "=ISERROR(C2)",
              },
            ],
          },
          format: {
            backgroundColor: {
              red: 1,
              green: 0.92,
              blue: 0.92,
            },
          },
        },
        ranges: [
          {
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 2,
            endColumnIndex: 3,
            sheetId: 12,
          },
        ],
      },
    },
  });
  assert.equal(buildErrorConditionalFormatRequests(12, [{
    startRow: 2,
    endRow: 1000,
    startColumn: 3,
    endColumn: 3,
    backgroundColor: {
      red: 1,
      green: 0.92,
      blue: 0.92,
    },
  }], 1)[0].addConditionalFormatRule.index, 1);
  assert.equal(buildFormulaRowFormatRequest(12, 2, 5).repeatCell.range.endRowIndex, 2);
  assert.equal(buildFormulaColumnFormatRequest(12, 2, 6).repeatCell.range.startColumnIndex, 1);
  assert.deepEqual(buildNumberFormatRequests(12, [{
    column: 4,
    endRow: 13,
    pattern: "$#,##0.00",
    startRow: 10,
    type: "CURRENCY",
  }])[0].repeatCell.range, {
    endColumnIndex: 4,
    endRowIndex: 13,
    sheetId: 12,
    startColumnIndex: 3,
    startRowIndex: 9,
  });
  assert.deepEqual(buildFormulaCellFormatRequests(12, [["'=A1", ""], ["x", "'HOODLEFINANCE(B2,\"name\")"]]).map(function (request) {
    return request.repeatCell.range;
  }), [
    {
      endColumnIndex: 1,
      endRowIndex: 1,
      sheetId: 12,
      startColumnIndex: 0,
      startRowIndex: 0,
    },
    {
      endColumnIndex: 2,
      endRowIndex: 2,
      sheetId: 12,
      startColumnIndex: 1,
      startRowIndex: 1,
    },
  ]);
  assert.equal(
    buildFormulaCellFormatRequests(12, [["'=A1"]])[0].repeatCell.cell.userEnteredFormat.wrapStrategy,
    "CLIP"
  );
  assert.equal(
    Object.hasOwn(buildFormulaCellFormatRequests(12, [["'=A1"]])[0].repeatCell.cell.userEnteredFormat, "backgroundColor"),
    false
  );
  assert.equal(
    buildFormulaCellFormatRequests(12, [["'=A1"]])[0].repeatCell.fields,
    "userEnteredFormat(horizontalAlignment,textFormat,wrapStrategy)"
  );
});

test("demo README block renders a placeholder before the public sheet exists", function () {
  assert.match(renderDemoReadmeBlock(""), /will be linked here/);
  assert.match(renderDemoReadmeBlock("https://docs.google.com/spreadsheets/d/demo/edit"), /public demo sheet/);
});

test("replaceDemoReadmeBlock replaces an existing marker section", function () {
  const original = [
    "# Example",
    "",
    "<!-- DEMO_SHEET_LINK:START -->",
    "old text",
    "<!-- DEMO_SHEET_LINK:END -->",
    "",
    "## Quick Start",
  ].join("\n");
  const updated = replaceDemoReadmeBlock(original, "https://docs.google.com/spreadsheets/d/demo/edit");

  assert.doesNotMatch(updated, /old text/);
  assert.match(updated, /public demo sheet/);
});

test("the tracked demo-sheet config validates and its TSV paths exist", function () {
  const config = loadDemoSheetConfig(false);
  const liveConfig = loadDemoSheetConfig(true);

  validateConfig(config);
  validateConfig(liveConfig);
  config.tabs.forEach(function (tab) {
    assert.equal(fs.existsSync(resolveRepoPath(tab.path)), true, tab.path);
  });
  liveConfig.tabs.forEach(function (tab) {
    assert.equal(fs.existsSync(resolveRepoPath(tab.path)), true, tab.path);
  });
});
