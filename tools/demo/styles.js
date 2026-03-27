"use strict";

const DEFAULT_STYLES = {
  sheetBody: {
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
        wrapStrategy: "CLIP",
      },
    },
    fields: "userEnteredFormat",
  },
  headerRow: {
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
  },
  calloutRow: {
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
  },
  formulaBand: {
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
  },
  formulaCell: {
    cell: {
      userEnteredFormat: {
        horizontalAlignment: "LEFT",
        textFormat: {
          italic: true,
        },
        wrapStrategy: "CLIP",
      },
    },
    fields: "userEnteredFormat(horizontalAlignment,textFormat,wrapStrategy)",
  },
};

function normalizeStyleRegistry(styles) {
  const registry = {};

  Object.keys(DEFAULT_STYLES).forEach(function (name) {
    registry[name] = normalizeStyleDefinition_(DEFAULT_STYLES[name]);
  });

  Object.keys(styles || {}).forEach(function (name) {
    registry[name] = normalizeStyleDefinition_(styles[name]);
  });

  return registry;
}

function normalizeStyleDefinition_(styleDefinition) {
  return {
    cell: copyJson_(styleDefinition.cell),
    fields: String(styleDefinition.fields || ""),
  };
}

function buildStyleRepeatCellRequest(sheetId, styleDefinition, range) {
  const style = normalizeStyleDefinition_(styleDefinition);

  return {
    repeatCell: {
      cell: style.cell,
      fields: style.fields,
      range: Object.assign({ sheetId: sheetId }, range),
    },
  };
}

function buildFormulaCellFormatRequests(sheetId, values, styleDefinition) {
  const requests = [];
  const style = normalizeStyleDefinition_(styleDefinition || DEFAULT_STYLES.formulaCell);
  let rowIndex;
  let columnIndex;
  let row;
  let value;

  for (rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    row = Array.isArray(values[rowIndex]) ? values[rowIndex] : [];

    for (columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      value = String(row[columnIndex] == null ? "" : row[columnIndex]);

      if (value.indexOf("'") === 0) {
        requests.push(buildFormulaCellFormatRequest(sheetId, rowIndex + 1, columnIndex + 1, style));
      }
    }
  }

  return requests;
}

function buildFormulaCellFormatRequest(sheetId, rowNumber, columnNumber, styleDefinition) {
  const style = normalizeStyleDefinition_(styleDefinition || DEFAULT_STYLES.formulaCell);

  return buildStyleRepeatCellRequest(sheetId, style, {
    startRowIndex: rowNumber - 1,
    endRowIndex: rowNumber,
    startColumnIndex: columnNumber - 1,
    endColumnIndex: columnNumber,
  });
}

function buildResolvedStyleApplications(formatting) {
  const applications = formatting.styleApplications.slice();

  if (!hasStyleApplicationTarget_(applications, "sheet")) {
    applications.unshift({
      style: "sheetBody",
      target: { sheet: true },
    });
  }

  if (!hasStyleApplicationTarget_(applications, "formulaCells")) {
    applications.push({
      style: "formulaCell",
      target: { formulaCells: true },
    });
  }

  return applications;
}

function hasStyleApplicationTarget_(applications, targetName) {
  return applications.some(function (application) {
    return Boolean(application && application.target && application.target[targetName]);
  });
}

function buildStyleApplicationRequests(sheetId, styleRegistry, applications, context) {
  const requests = [];

  applications.forEach(function (application) {
    const style = styleRegistry[application.style];

    if (!style) {
      throw new Error("Unknown style \"" + application.style + "\".");
    }

    requests.push.apply(
      requests,
      buildStyleTargetRequests_(sheetId, style, application.target, context)
    );
  });

  return requests;
}

function buildStyleTargetRequests_(sheetId, style, target, context) {
  const requests = [];
  let i;

  if (target.sheet) {
    if (context.sheetRowCount > 0 && context.sheetColumnCount > 0) {
      requests.push(buildStyleRepeatCellRequest(sheetId, style, {
        startRowIndex: 0,
        endRowIndex: context.sheetRowCount,
        startColumnIndex: 0,
        endColumnIndex: context.sheetColumnCount,
      }));
    }
    return requests;
  }

  if (target.rows) {
    for (i = 0; i < target.rows.length; i += 1) {
      if (context.maxColumns <= 0) {
        break;
      }

      requests.push(buildStyleRepeatCellRequest(sheetId, style, {
        startRowIndex: target.rows[i] - 1,
        endRowIndex: target.rows[i],
        startColumnIndex: 0,
        endColumnIndex: context.maxColumns,
      }));
    }
    return requests;
  }

  if (target.columns) {
    for (i = 0; i < target.columns.length; i += 1) {
      if (context.values.length <= 0) {
        break;
      }

      requests.push(buildStyleRepeatCellRequest(sheetId, style, {
        startRowIndex: 0,
        endRowIndex: context.values.length,
        startColumnIndex: target.columns[i] - 1,
        endColumnIndex: target.columns[i],
      }));
    }
    return requests;
  }

  if (target.ranges) {
    for (i = 0; i < target.ranges.length; i += 1) {
      requests.push(buildStyleRepeatCellRequest(sheetId, style, {
        startRowIndex: target.ranges[i].startRow - 1,
        endRowIndex: target.ranges[i].endRow,
        startColumnIndex: target.ranges[i].startColumn - 1,
        endColumnIndex: target.ranges[i].endColumn,
      }));
    }
    return requests;
  }

  if (target.sections) {
    for (i = 0; i < target.sections.length; i += 1) {
      requests.push(buildStyleRepeatCellRequest(sheetId, style, {
        startRowIndex: target.sections[i].row - 1,
        endRowIndex: target.sections[i].row,
        startColumnIndex: 0,
        endColumnIndex: target.sections[i].columns,
      }));
    }
    return requests;
  }

  if (target.formulaCells) {
    return buildFormulaCellFormatRequests(sheetId, context.values, style);
  }

  return requests;
}

function copyJson_(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  DEFAULT_STYLES,
  buildFormulaCellFormatRequests,
  buildResolvedStyleApplications,
  buildStyleApplicationRequests,
  buildStyleRepeatCellRequest,
  normalizeStyleRegistry,
};
