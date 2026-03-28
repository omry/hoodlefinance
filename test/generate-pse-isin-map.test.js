/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  dedupeListings,
  extractCompanySecurityListings,
  writeOutputs,
} = require("../tools/generate-pse-isin-map.js");

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createFixtureState() {
  return {
    isinMap: {
      PHY000000001: "PSE:AAA",
    },
    quoteRecords: [
      {
        companyId: "1",
        isin: "PHY000000001",
        name: "AAA Holdings",
        securityId: "11",
        symbol: "AAA",
      },
      {
        companyId: "2",
        isin: "",
        name: "DNA Corp",
        securityId: "22",
        symbol: "DNA",
      },
    ],
    stats: {
      totalItems: 2,
      totalPages: 1,
    },
  };
}

test("extractCompanySecurityListings captures alternate company securities", function () {
  const ctx = {
    hf_extractPseCompanyName_() {
      return "Ayala Corporation";
    },
  };
  const listings = extractCompanySecurityListings(
    ctx,
    `
<div class="compInfo"><p>Ayala Corporation</p></div>
<select name="security_id">
  <option value="180" selected>AC</option>
  <option value="698">ACPAR</option>
  <option value="722">ACPB3</option>
</select>
`,
    {
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      symbol: "AC",
    },
  );

  assert.deepEqual(listings, [
    {
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "180",
      source: "company-security",
      symbol: "AC",
    },
    {
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "698",
      source: "company-security",
      symbol: "ACPAR",
    },
    {
      companyId: "57",
      name: "Ayala Corporation",
      securityId: "722",
      source: "company-security",
      symbol: "ACPB3",
    },
  ]);
});

test("dedupeListings removes repeated company-security-symbol tuples", function () {
  assert.deepEqual(
    dedupeListings([
      { companyId: "57", securityId: "180", symbol: "AC" },
      { companyId: "57", securityId: "180", symbol: "AC" },
      { companyId: "57", securityId: "698", symbol: "ACPAR" },
    ]),
    [
      { companyId: "57", securityId: "180", symbol: "AC" },
      { companyId: "57", securityId: "698", symbol: "ACPAR" },
    ],
  );
});

test("writeOutputs preserves the existing updated_at when the generated map is unchanged", function () {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hoodlefinance-pse-map-"),
  );
  const dataPath = path.join(rootDir, "pse-isin-map.properties");
  const fixture = createFixtureState();
  const firstUpdatedAt = "2026-03-13T18:34:56.295Z";
  const secondUpdatedAt = "2026-03-16T11:49:04.565Z";

  assert.equal(
    writeOutputs(fixture.isinMap, fixture.quoteRecords, fixture.stats, {
      dataPath,
      updatedAt: firstUpdatedAt,
    }).changed,
    true,
  );

  const firstText = fs.readFileSync(dataPath, "utf8");

  assert.equal(
    writeOutputs(fixture.isinMap, fixture.quoteRecords, fixture.stats, {
      dataPath,
      updatedAt: secondUpdatedAt,
    }).changed,
    false,
  );
  assert.equal(fs.readFileSync(dataPath, "utf8"), firstText);
  assert.match(
    firstText,
    new RegExp("# updated_at=" + escapeRegex(firstUpdatedAt)),
  );
});

test("writeOutputs refreshes updated_at when the generated map changes", function () {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hoodlefinance-pse-map-"),
  );
  const dataPath = path.join(rootDir, "pse-isin-map.properties");
  const fixture = createFixtureState();
  const firstUpdatedAt = "2026-03-13T18:34:56.295Z";
  const secondUpdatedAt = "2026-03-16T11:49:04.565Z";

  writeOutputs(fixture.isinMap, fixture.quoteRecords, fixture.stats, {
    dataPath,
    updatedAt: firstUpdatedAt,
  });

  assert.equal(
    writeOutputs(
      {
        PHY000000001: "PSE:AAA",
        PHY000000002: "PSE:BBB",
      },
      fixture.quoteRecords.concat([
        {
          companyId: "3",
          isin: "PHY000000002",
          name: "BBB Corp",
          securityId: "33",
          symbol: "BBB",
        },
      ]),
      {
        totalItems: 3,
        totalPages: 1,
      },
      {
        dataPath,
        updatedAt: secondUpdatedAt,
      },
    ).changed,
    true,
  );

  const nextText = fs.readFileSync(dataPath, "utf8");
  assert.match(
    nextText,
    new RegExp("# updated_at=" + escapeRegex(secondUpdatedAt)),
  );
  assert.match(nextText, /PHY000000002=PSE:BBB/);
});
