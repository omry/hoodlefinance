#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "preferred-reit-whitelist.json",
);
const DEFAULT_SOURCE = {
  cik: "0001559109",
  label: "PFFR",
  name: "InfraCap REIT Preferred ETF",
  ticker: "PFFR",
};
const DEFAULT_USER_AGENT =
  "hoodlefinance-preferred-reit-whitelist/1.0 (contact=support@hoodlefinance.com)";

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCik(cik) {
  return normalizeText(cik).replace(/\D/g, "").padStart(10, "0");
}

function buildSubmissionsUrl(cik) {
  return (
    "https://data.sec.gov/submissions/CIK" + normalizeCik(cik) + ".json"
  );
}

function buildFilingIndexUrl(cik, accessionNumber) {
  const normalizedCik = normalizeCik(cik).replace(/^0+/, "") || "0";
  const accessionPath = normalizeText(accessionNumber).replace(/-/g, "");
  return (
    "https://www.sec.gov/Archives/edgar/data/" +
    normalizedCik +
    "/" +
    accessionPath +
    "/" +
    normalizeText(accessionNumber) +
    "-index.htm"
  );
}

function decodeXmlEntities(text) {
  return String(text || "").replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    function (_match, entity) {
      const normalizedEntity = String(entity || "");

      if (normalizedEntity === "amp") {
        return "&";
      }

      if (normalizedEntity === "lt") {
        return "<";
      }

      if (normalizedEntity === "gt") {
        return ">";
      }

      if (normalizedEntity === "quot") {
        return '"';
      }

      if (normalizedEntity === "apos") {
        return "'";
      }

      if (/^#x/i.test(normalizedEntity)) {
        return String.fromCodePoint(
          Number.parseInt(normalizedEntity.slice(2), 16),
        );
      }

      if (/^#/.test(normalizedEntity)) {
        return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10));
      }

      return "&" + normalizedEntity + ";";
    },
  );
}

function normalizeXmlValue(value) {
  return decodeXmlEntities(String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1"))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstTagValue(block, tagNames) {
  const candidates = Array.isArray(tagNames) ? tagNames : [tagNames];
  let i;
  let tagName;
  let match;

  for (i = 0; i < candidates.length; i += 1) {
    tagName = String(candidates[i] || "").trim();

    if (!tagName) {
      continue;
    }

    match = String(block || "").match(
      new RegExp(
        "<" + tagName + "\\b[^>]*\\bvalue=\"([^\"]+)\"[^>]*\\/?>",
        "i",
      ),
    );

    if (match) {
      return normalizeXmlValue(match[1]);
    }

    match = String(block || "").match(
      new RegExp("<" + tagName + "\\b[^>]*>([\\s\\S]*?)</" + tagName + ">", "i"),
    );

    if (match) {
      return normalizeXmlValue(match[1]);
    }
  }

  return "";
}

function extractXmlBlocks(xml, tagName) {
  return (
    String(xml || "").match(
      new RegExp(
        "<" + tagName + "\\b[\\s\\S]*?</" + tagName + ">",
        "gi",
      ),
    ) || []
  );
}

function normalizeHoldingTicker(ticker) {
  return normalizeText(ticker).toUpperCase();
}

function isPreferredHolding(holding) {
  const assetCategory = normalizeText(holding.assetCategory).toUpperCase();
  const issueText = normalizeText(
    holding.issueTitle + " " + holding.issuerName + " " + holding.securityName,
  ).toUpperCase();

  if (assetCategory === "EQUITY-PREFERRED" || assetCategory === "EP") {
    return true;
  }

  return /PREFERRED/.test(assetCategory) || /PREFERRED/.test(issueText);
}

function parseNportHoldings(xml) {
  const blocks = extractXmlBlocks(xml, "invstOrSec");
  const holdings = [];
  let i;
  let block;
  let ticker;
  let securityName;
  let issueTitle;
  let assetCategory;
  let issuerType;
  let issuerName;

  for (i = 0; i < blocks.length; i += 1) {
    block = blocks[i];
    ticker = normalizeHoldingTicker(
      extractFirstTagValue(block, ["ticker", "tickerSymb", "tickerSymbol"]),
    );
    issuerName = extractFirstTagValue(block, [
      "issuerName",
      "name",
      "nm",
    ]);
    issueTitle = extractFirstTagValue(block, [
      "issueTitle",
      "title",
      "titleOfClass",
      "securityTitle",
    ]);
    securityName = extractFirstTagValue(block, [
      "securityName",
      "name",
      "issuerName",
    ]);
    assetCategory = extractFirstTagValue(block, [
      "assetCat",
      "assetCategory",
      "assetType",
      "assetTyp",
    ]);
    issuerType = extractFirstTagValue(block, [
      "issuerType",
      "issuerCategory",
      "issuerCat",
    ]);

    if (!ticker || !isPreferredHolding({
      assetCategory: assetCategory,
      issueTitle: issueTitle,
      issuerName: issuerName,
      securityName: securityName,
    })) {
      continue;
    }

    holdings.push({
      assetCategory: assetCategory,
      issuerName: issuerName,
      issuerType: issuerType,
      issueTitle: issueTitle,
      securityName: securityName,
      ticker: ticker,
    });
  }

  return dedupeHoldings(holdings);
}

function dedupeHoldings(holdings) {
  const deduped = [];
  const seen = {};
  let i;
  let holding;
  let key;

  for (i = 0; i < holdings.length; i += 1) {
    holding = holdings[i];
    key = normalizeText(holding.ticker).toUpperCase();

    if (!key || seen[key]) {
      continue;
    }

    seen[key] = true;
    deduped.push(holding);
  }

  return deduped;
}

function extractXmlDocumentUrl(indexHtml, indexUrl) {
  const matches = [];
  const sourceText = String(indexHtml || "");
  let match;
  let chosen;

  for (match of sourceText.matchAll(/href="([^"]+\.xml[^"]*)"/gi)) {
    matches.push(match[1]);
  }

  chosen =
    matches.find(function (href) {
      return /primary_doc\.xml/i.test(href) && !/xslForm/i.test(href);
    }) ||
    matches.find(function (href) {
      return /\/primary_doc\.xml$/i.test(href);
    }) ||
    matches[0];

  if (!chosen) {
    throw new Error("Could not find a primary XML document link in the SEC filing index.");
  }

  return new URL(chosen.replace(/&amp;/g, "&"), indexUrl).toString();
}

function buildFetchHeaders(userAgent) {
  return {
    Accept: "application/json,text/html,application/xml,text/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": normalizeText(userAgent) || DEFAULT_USER_AGENT,
  };
}

async function fetchText(url, options, fetchFn) {
  const request = fetchFn || (typeof fetch === "function" ? fetch.bind(globalThis) : null);

  if (typeof request !== "function") {
    throw new Error("No fetch implementation is available.");
  }

  const response = await request(url, options || {});

  if (!response || response.ok === false || (response.status && response.status !== 200)) {
    throw new Error(
      "Fetch failed for " +
        url +
        " (" +
        String((response && response.status) || "unknown") +
        ").",
    );
  }

  return response.text();
}

async function fetchJson(url, options, fetchFn) {
  return JSON.parse(await fetchText(url, options, fetchFn));
}

async function loadPreferredReitSource(source, options) {
  const normalizedSource = source || DEFAULT_SOURCE;
  const fetchFn = options && options.fetchFn ? options.fetchFn : null;
  const userAgent = options && options.userAgent ? options.userAgent : DEFAULT_USER_AGENT;
  const submissionsUrl = buildSubmissionsUrl(normalizedSource.cik);
  const submissions = await fetchJson(
    submissionsUrl,
    { headers: buildFetchHeaders(userAgent) },
    fetchFn,
  );
  const recent =
    submissions && submissions.filings && submissions.filings.recent
      ? submissions.filings.recent
      : null;
  const forms = recent && Array.isArray(recent.form) ? recent.form : [];
  const targetTicker = normalizeText(normalizedSource.ticker).toUpperCase();
  const targetName = normalizeText(normalizedSource.name).toUpperCase();
  let filing;
  let indexUrl;
  let indexHtml;
  let i;
  let form;

  if (!recent) {
    throw new Error("SEC submissions payload is missing recent filings data.");
  }

  for (i = 0; i < forms.length; i += 1) {
    form = normalizeText(forms[i]).toUpperCase();

    if (!/^NPORT-P(?:\/A)?$/.test(form)) {
      continue;
    }

    filing = {
      accessionNumber: normalizeText(
        recent.accessionNumber && recent.accessionNumber[i],
      ),
      filingDate: normalizeText(recent.filingDate && recent.filingDate[i]),
      form: form,
      primaryDocDescription: normalizeText(
        recent.primaryDocDescription && recent.primaryDocDescription[i],
      ),
      reportDate: normalizeText(recent.reportDate && recent.reportDate[i]),
    };
    indexUrl = buildFilingIndexUrl(normalizedSource.cik, filing.accessionNumber);
    indexHtml = await fetchText(
      indexUrl,
      { headers: buildFetchHeaders(userAgent) },
      fetchFn,
    );

    if (
      (targetTicker && indexHtml.toUpperCase().indexOf(targetTicker) >= 0) ||
      (targetName && indexHtml.toUpperCase().indexOf(targetName) >= 0)
    ) {
      break;
    }

    filing = null;
    indexUrl = "";
    indexHtml = "";
  }

  if (!filing || !indexUrl || !indexHtml) {
    throw new Error(
      'Could not find a recent NPORT-P filing for source "' +
        normalizeText(normalizedSource.label || normalizedSource.name) +
        '".',
    );
  }

  const xmlUrl = extractXmlDocumentUrl(indexHtml, indexUrl);
  const xml = await fetchText(
    xmlUrl,
    { headers: buildFetchHeaders(userAgent) },
    fetchFn,
  );
  const holdings = parseNportHoldings(xml);

  return {
    source: {
      cik: normalizeCik(normalizedSource.cik),
      label: normalizeText(normalizedSource.label) || normalizeText(normalizedSource.name),
      name: normalizeText(normalizedSource.name),
      ticker: normalizeText(normalizedSource.ticker),
      submissionsUrl: submissionsUrl,
      filing: {
        accessionNumber: filing.accessionNumber,
        filingDate: filing.filingDate,
        form: filing.form,
        indexUrl: indexUrl,
        primaryDocDescription: filing.primaryDocDescription,
        reportDate: filing.reportDate,
        xmlUrl: xmlUrl,
      },
    },
    holdings: holdings.map(function (holding) {
      return {
        sourceCik: normalizeCik(normalizedSource.cik),
        sourceName: normalizeText(normalizedSource.name),
        ticker: holding.ticker,
      };
    }),
  };
}

async function generatePreferredReitDataset(options) {
  const normalizedOptions = options || {};
  const source = normalizedOptions.source || DEFAULT_SOURCE;
  const sourceDataset = await loadPreferredReitSource(source, normalizedOptions);
  const holdings = sourceDataset.holdings.slice().sort(function (left, right) {
    return left.ticker.localeCompare(right.ticker);
  });
  const tickers = holdings
    .map(function (holding) {
      return holding.ticker;
    })
    .filter(function (symbol, index, all) {
      return all.indexOf(symbol) === index;
    });

  return {
    generatedAt: new Date().toISOString(),
    preferredTickers: tickers,
  };
}

function writePreferredReitDataset(outputPath, dataset) {
  const normalizedPath = normalizeText(outputPath) || DEFAULT_OUTPUT_PATH;
  const payload = JSON.stringify(dataset, null, 2) + "\n";
  const previous = fs.existsSync(normalizedPath)
    ? fs.readFileSync(normalizedPath, "utf8")
    : null;

  if (previous === payload) {
    return {
      changed: false,
      path: normalizedPath,
    };
  }

  fs.mkdirSync(path.dirname(normalizedPath), { recursive: true });
  fs.writeFileSync(normalizedPath, payload, "utf8");

  return {
    changed: true,
    path: normalizedPath,
  };
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const options = {
    outputPath: DEFAULT_OUTPUT_PATH,
    source: Object.assign({}, DEFAULT_SOURCE),
    userAgent: process.env.HOODLEFINANCE_SEC_USER_AGENT || DEFAULT_USER_AGENT,
  };
  let i;
  let arg;

  for (i = 0; i < args.length; i += 1) {
    arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--output" && i + 1 < args.length) {
      options.outputPath = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--cik" && i + 1 < args.length) {
      options.source.cik = normalizeCik(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === "--name" && i + 1 < args.length) {
      options.source.name = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--label" && i + 1 < args.length) {
      options.source.label = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--ticker" && i + 1 < args.length) {
      options.source.ticker = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--user-agent" && i + 1 < args.length) {
      options.userAgent = args[i + 1];
      i += 1;
      continue;
    }

    throw new Error("Unknown argument: " + arg);
  }

  return options;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage: node tools/generate-preferred-reit-whitelist.js [options]",
      "",
      "Options:",
      "  --output <path>      Write the dataset JSON to a file.",
      "  --cik <value>        SEC CIK for the source N-PORT filer.",
      "  --name <value>       Human-readable source name.",
      "  --label <value>      Short source label.",
      "  --ticker <value>     Target ticker symbol to match in filing indexes.",
      "  --user-agent <value> SEC-friendly User-Agent header.",
      "  --dry-run            Fetch and summarize without writing.",
      "  -h, --help           Show this help text.",
      "",
      "Default source: PFFR / InfraCap REIT Preferred ETF.",
    ].join("\n") + "\n",
  );
}

async function main(argv, deps) {
  const options = parseArgs(argv || process.argv.slice(2));
  const fetchFn = deps && deps.fetchFn ? deps.fetchFn : null;

  if (options.help) {
    printUsage();
    return {
      code: 0,
    };
  }

  const dataset = await generatePreferredReitDataset({
    fetchFn: fetchFn,
    source: options.source,
    userAgent: options.userAgent,
  });

  if (!options.dryRun) {
    writePreferredReitDataset(options.outputPath, dataset);
  }

  process.stdout.write(
    JSON.stringify(
      {
        generatedAt: dataset.generatedAt,
        records: dataset.preferredTickers.length,
      },
      null,
      2,
    ) + "\n",
  );

  return {
    code: 0,
    dataset: dataset,
  };
}

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  buildFilingIndexUrl,
  buildSubmissionsUrl,
  dedupeHoldings,
  extractFirstTagValue,
  extractXmlBlocks,
  extractXmlDocumentUrl,
  generatePreferredReitDataset,
  isPreferredHolding,
  loadPreferredReitSource,
  main,
  normalizeCik,
  normalizeHoldingTicker,
  normalizeText,
  normalizeXmlValue,
  parseArgs,
  parseNportHoldings,
  printUsage,
  writePreferredReitDataset,
};
