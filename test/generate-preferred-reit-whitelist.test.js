/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildFilingIndexUrl,
  buildSubmissionsUrl,
  generatePreferredReitDataset,
  parseNportHoldings,
  writePreferredReitDataset,
} = require("../tools/generate-preferred-reit-whitelist.js");

function createResponse(status, body) {
  return {
    ok: status === 200,
    status: status,
    text() {
      return Promise.resolve(String(body || ""));
    },
  };
}

test("parseNportHoldings keeps only preferred holdings", () => {
  const holdings = parseNportHoldings(
    [
      "<root>",
      "  <invstOrSec>",
      "    <issuerName>Annaly Capital Management, Inc.</issuerName>",
      "    <title>Series I Preferred Stock</title>",
      "    <ticker>NLY.PI</ticker>",
      "    <assetCat>equity-preferred</assetCat>",
      "    <issuerType>corporate</issuerType>",
      "  </invstOrSec>",
      "  <invstOrSec>",
      "    <issuerName>Rithm Capital Corp.</issuerName>",
      "    <title>Series C Preferred Shares</title>",
      "    <ticker>RITM.PC</ticker>",
      "    <issuerType>corporate</issuerType>",
      "  </invstOrSec>",
      "  <invstOrSec>",
      "    <issuerName>Berkshire Hathaway Inc.</issuerName>",
      "    <title>Common Stock</title>",
      "    <ticker>BRK.A</ticker>",
      "    <assetCat>equity-common</assetCat>",
      "    <issuerType>corporate</issuerType>",
      "  </invstOrSec>",
      "</root>",
    ].join("\n"),
  );

  assert.deepEqual(
    holdings.map(function (holding) {
      return holding.ticker;
    }),
    ["NLY.PI", "RITM.PC"],
  );
  assert.equal(holdings.length, 2);
});

test("generatePreferredReitDataset follows the SEC filing path and writes a dataset", async () => {
  const source = {
    cik: "0001559109",
    label: "PFFR",
    name: "InfraCap REIT Preferred ETF",
    ticker: "PFFR",
  };
  const submissionsUrl = buildSubmissionsUrl(source.cik);
  const targetAccessionNumber = "0001021408-24-006614";
  const targetIndexUrl = buildFilingIndexUrl(source.cik, targetAccessionNumber);
  const targetXmlUrl = "https://www.sec.gov/Archives/edgar/data/1559109/000102140824006614/primary_doc.xml";
  const skipAccessionNumber = "0000940400-26-012476";
  const skipIndexUrl = buildFilingIndexUrl(source.cik, skipAccessionNumber);
  const calls = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hoodlefinance-reit-"));
  const outputPath = path.join(tempDir, "preferred-reit-whitelist.json");
  const submissions = {
    filings: {
      recent: {
        accessionNumber: [
          skipAccessionNumber,
          targetAccessionNumber,
        ],
        filingDate: ["2026-03-31", "2024-08-30"],
        form: ["NPORT-P", "NPORT-P"],
        primaryDocDescription: ["NPORT-P", "NPORT-P"],
        reportDate: ["2026-01-30", "2024-06-30"],
      },
    },
  };
  const skipIndexHtml = [
    "<html><body>",
    "<table><tr><td>Series and Classes/Contracts Information:</td></tr>",
    "<tr><td>Other ETF</td><td>OTHR</td></tr>",
    '<a href="/Archives/edgar/data/1559109/000094040026012476/primary_doc.xml">primary_doc.xml</a>',
    "</body></html>",
  ].join("\n");
  const targetIndexHtml = [
    "<html><body>",
    "<table><tr><td>Series and Classes/Contracts Information:</td></tr>",
    "<tr><td>InfraCap REIT Preferred ETF</td><td>PFFR</td></tr>",
    '<a href="/Archives/edgar/data/1559109/000102140824006614/primary_doc.xml">primary_doc.xml</a>',
    "</body></html>",
  ].join("\n");
  const xml = [
    "<root>",
    "  <invstOrSec>",
    "    <issuerName>Annaly Capital Management, Inc.</issuerName>",
    "    <title>Series I Preferred Stock</title>",
    "    <ticker>NLY.PI</ticker>",
    "    <assetCat>equity-preferred</assetCat>",
    "    <issuerType>corporate</issuerType>",
    "  </invstOrSec>",
    "  <invstOrSec>",
    "    <issuerName>Rithm Capital Corp.</issuerName>",
    "    <title>Series C Preferred Shares</title>",
    "    <ticker>RITM.PC</ticker>",
    "    <assetCat>equity-preferred</assetCat>",
    "    <issuerType>corporate</issuerType>",
    "  </invstOrSec>",
    "  <invstOrSec>",
    "    <issuerName>Berkshire Hathaway Inc.</issuerName>",
    "    <title>Common Stock</title>",
    "    <ticker>BRK.A</ticker>",
    "    <assetCat>equity-common</assetCat>",
    "    <issuerType>corporate</issuerType>",
    "  </invstOrSec>",
    "</root>",
  ].join("\n");

  async function fetchFn(url, options) {
    calls.push({
      options: options,
      url: url,
    });

    if (url === submissionsUrl) {
      return createResponse(200, JSON.stringify(submissions));
    }

    if (url === skipIndexUrl) {
      return createResponse(200, skipIndexHtml);
    }

    if (url === targetIndexUrl) {
      return createResponse(200, targetIndexHtml);
    }

    if (url === targetXmlUrl) {
      return createResponse(200, xml);
    }

    throw new Error("Unexpected URL " + url);
  }

  const dataset = await generatePreferredReitDataset({
    fetchFn: fetchFn,
    source: source,
    userAgent: "hoodlefinance-test/1.0",
  });

  assert.deepEqual(dataset.preferredTickers, ["NLY.PI", "RITM.PC"]);
  assert.equal(Object.hasOwn(dataset, "generatedAt"), false);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.headers["User-Agent"], "hoodlefinance-test/1.0");
  assert.equal(calls[1].options.headers["User-Agent"], "hoodlefinance-test/1.0");
  assert.equal(calls[2].options.headers["User-Agent"], "hoodlefinance-test/1.0");
  assert.equal(calls[3].options.headers["User-Agent"], "hoodlefinance-test/1.0");

  const firstWrite = writePreferredReitDataset(outputPath, dataset, {
    now: "2026-04-01T00:00:00.000Z",
  });
  const secondWrite = writePreferredReitDataset(outputPath, dataset, {
    now: "2026-04-01T01:00:00.000Z",
  });

  assert.equal(firstWrite.changed, true);
  assert.equal(secondWrite.changed, false);
  assert.deepEqual(firstWrite.dataset, {
    lastChange: "2026-04-01T00:00:00.000Z",
    preferredTickers: ["NLY.PI", "RITM.PC"],
  });
  assert.deepEqual(secondWrite.dataset, firstWrite.dataset);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), firstWrite.dataset);
});
