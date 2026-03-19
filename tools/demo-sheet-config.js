"use strict";

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

  validateStyles_(config.styles, issues);

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

  validateStyleApplications_(formatting.styleApplications, tabLabel, issues);
  validateColumnBackgrounds_(formatting.columnBackgrounds, tabLabel, issues);
  validateErrorConditionalFormats_(formatting.errorConditionalFormats, tabLabel, issues);
  validateNumberFormats_(formatting.numberFormats, tabLabel, issues);
  validateMergedRanges_(formatting.mergedRanges, tabLabel, issues);
}

function validateStyles_(styles, issues) {
  let styleName;
  let styleDefinition;

  if (styles == null) {
    return;
  }

  if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
    issues.push("Top-level \"styles\" must be an object.");
    return;
  }

  Object.keys(styles).forEach(function (name) {
    styleName = name;
    styleDefinition = styles[name];

    if (!styleDefinition || typeof styleDefinition !== "object" || Array.isArray(styleDefinition)) {
      issues.push("Style \"" + styleName + "\" must be an object.");
      return;
    }

    if (!styleDefinition.cell || typeof styleDefinition.cell !== "object" || Array.isArray(styleDefinition.cell)) {
      issues.push("Style \"" + styleName + "\" must contain a \"cell\" object.");
    }

    if (!String(styleDefinition.fields || "").trim()) {
      issues.push("Style \"" + styleName + "\" must contain a non-empty \"fields\" string.");
    }
  });
}

function validateStyleApplications_(styleApplications, tabLabel, issues) {
  if (styleApplications == null) {
    return;
  }

  if (!Array.isArray(styleApplications)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.styleApplications\".");
    return;
  }

  styleApplications.forEach(function (application) {
    const target = application && application.target ? application.target : null;
    let selectorCount = 0;

    if (!application || typeof application !== "object") {
      issues.push("Tab \"" + tabLabel + "\" has invalid style application entry.");
      return;
    }

    if (!String(application.style || "").trim()) {
      issues.push("Tab \"" + tabLabel + "\" has a style application without a style name.");
    }

    if (!target || typeof target !== "object" || Array.isArray(target)) {
      issues.push("Tab \"" + tabLabel + "\" has a style application without a valid target.");
      return;
    }

    if (target.sheet === true) {
      selectorCount += 1;
    }

    if (target.formulaCells === true) {
      selectorCount += 1;
    }

    if (target.rows != null) {
      selectorCount += 1;
      validateRowNumbers_(target.rows, "style target rows", tabLabel, issues);
    }

    if (target.columns != null) {
      selectorCount += 1;
      validateRowNumbers_(target.columns, "style target columns", tabLabel, issues);
    }

    if (target.sections != null) {
      selectorCount += 1;
      validateFormattingSections_(target.sections, "style target sections", tabLabel, issues);
    }

    if (selectorCount !== 1) {
      issues.push("Tab \"" + tabLabel + "\" style applications must define exactly one target selector.");
    }
  });
}

function validateFormattingSections_(sections, label, tabLabel, issues) {
  if (sections == null) {
    return;
  }

  if (!Array.isArray(sections)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"" + label + "\".");
    return;
  }

  sections.forEach(function (section) {
    if (
      !section ||
      typeof section !== "object" ||
      !Number.isInteger(section.row) ||
      section.row < 1 ||
      !Number.isInteger(section.columns) ||
      section.columns < 1
    ) {
      issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " entry.");
    }
  });
}

function validateRowNumbers_(rows, label, tabLabel, issues) {
  if (rows == null) {
    return;
  }

  if (!Array.isArray(rows)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"" + label + "\".");
    return;
  }

  rows.forEach(function (rowNumber) {
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " entry: " + rowNumber);
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
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.column) ||
      entry.column < 1 ||
      !Number.isInteger(entry.startRow) ||
      entry.startRow < 1 ||
      !Number.isInteger(entry.endRow) ||
      entry.endRow < entry.startRow ||
      !String(entry.type || "").trim() ||
      !String(entry.pattern || "").trim()
    ) {
      issues.push("Tab \"" + tabLabel + "\" has invalid number format entry.");
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
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.column) ||
      entry.column < 1 ||
      (entry.startRow != null && (!Number.isInteger(entry.startRow) || entry.startRow < 1)) ||
      (entry.endRow != null &&
        (!Number.isInteger(entry.endRow) ||
          (entry.startRow != null && entry.endRow < entry.startRow) ||
          entry.endRow < 1))
    ) {
      issues.push("Tab \"" + tabLabel + "\" has invalid column background entry.");
      return;
    }

    validateRgbColor_(entry.backgroundColor, "column background", tabLabel, issues);
  });
}

function validateErrorConditionalFormats_(entries, tabLabel, issues) {
  if (entries == null) {
    return;
  }

  if (!Array.isArray(entries)) {
    issues.push("Tab \"" + tabLabel + "\" has invalid \"formatting.errorConditionalFormats\".");
    return;
  }

  entries.forEach(function (entry) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.startRow) ||
      entry.startRow < 1 ||
      !Number.isInteger(entry.endRow) ||
      entry.endRow < entry.startRow ||
      !Number.isInteger(entry.startColumn) ||
      entry.startColumn < 1 ||
      !Number.isInteger(entry.endColumn) ||
      entry.endColumn < entry.startColumn
    ) {
      issues.push("Tab \"" + tabLabel + "\" has invalid error conditional format entry.");
      return;
    }

    validateRgbColor_(entry.backgroundColor, "error conditional format", tabLabel, issues);
  });
}

function validateRgbColor_(color, label, tabLabel, issues) {
  if (!color || typeof color !== "object") {
    issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " color.");
    return;
  }

  ["red", "green", "blue"].forEach(function (channel) {
    const value = color[channel];
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
      issues.push("Tab \"" + tabLabel + "\" has invalid " + label + " color channel \"" + channel + "\".");
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
    if (
      !range ||
      typeof range !== "object" ||
      !Number.isInteger(range.startRow) ||
      range.startRow < 1 ||
      !Number.isInteger(range.endRow) ||
      range.endRow < range.startRow ||
      !Number.isInteger(range.startColumn) ||
      range.startColumn < 1 ||
      !Number.isInteger(range.endColumn) ||
      range.endColumn < range.startColumn
    ) {
      issues.push("Tab \"" + tabLabel + "\" has invalid merged range entry.");
    }
  });
}

function normalizeTabFormatting(formatting) {
  const normalized = formatting || {};

  return {
    autoResizeColumns: normalized.autoResizeColumns !== false,
    columnBackgrounds: Array.isArray(normalized.columnBackgrounds)
      ? normalized.columnBackgrounds.map(copyColumnBackground_)
      : [],
    columnPixelSizes: Array.isArray(normalized.columnPixelSizes) ? normalized.columnPixelSizes.slice() : [],
    errorConditionalFormats: Array.isArray(normalized.errorConditionalFormats)
      ? normalized.errorConditionalFormats.map(copyErrorConditionalFormat_)
      : [],
    freezeRows: Number(normalized.freezeRows || 0),
    styleApplications: Array.isArray(normalized.styleApplications)
      ? normalized.styleApplications.map(copyStyleApplication_)
      : [],
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

function copyStyleApplication_(application) {
  return {
    style: String(application.style || ""),
    target: copyStyleTarget_(application.target || {}),
  };
}

function copyStyleTarget_(target) {
  return {
    columns: Array.isArray(target.columns) ? target.columns.slice() : null,
    formulaCells: target.formulaCells === true,
    rows: Array.isArray(target.rows) ? target.rows.slice() : null,
    sections: Array.isArray(target.sections) ? target.sections.map(copyFormattingSection_) : null,
    sheet: target.sheet === true,
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

function copyErrorConditionalFormat_(entry) {
  return {
    backgroundColor: copyRgbColor_(entry.backgroundColor),
    endColumn: Number(entry.endColumn),
    endRow: Number(entry.endRow),
    startColumn: Number(entry.startColumn),
    startRow: Number(entry.startRow),
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

module.exports = {
  copyRgbColor: copyRgbColor_,
  normalizeTabFormatting,
  validateConfig,
};
