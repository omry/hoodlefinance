#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createUrlFetchApp } = require("./_shared/urlfetch-sync.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT_DIR, "hoodlefinance.js");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_PATH = path.join(DATA_DIR, "pse-isin-map.properties");
const PSE_SEARCH_URL = "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=";
const PSE_STOCK_DATA_URL = "https://edge.pse.com.ph/companyPage/stockData.do";

function loadHoodlefinance() {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const sandbox = {
    console,
    Date,
    JSON,
    encodeURIComponent,
    Array,
    String,
    Object,
    RegExp,
    Error,
    Map,
    CacheService: {
      getScriptCache() {
        return {
          get() {
            return null;
          },
          put() {},
        };
      },
    },
    UrlFetchApp: createUrlFetchApp(),
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

function extractPageStats(html) {
  const match = String(html || "").match(/\[(\d+)\s*\/\s*(\d+)\]\s*\[Total\s+(\d+)\]/s);

  if (!match) {
    throw new Error("Could not determine PSE directory page count.");
  }

  return {
    currentPage: Number(match[1]),
    totalItems: Number(match[3]),
    totalPages: Number(match[2]),
  };
}

function fetchTextOrThrow(ctx, url) {
  const response = ctx.UrlFetchApp.fetch(url);

  if (response.getResponseCode() !== 200) {
    throw new Error("Fetch failed for " + url + " (" + response.getResponseCode() + ").");
  }

  return response.getContentText();
}

function fetchAllListings(ctx) {
  const firstPageHtml = fetchTextOrThrow(ctx, PSE_SEARCH_URL);
  const stats = extractPageStats(firstPageHtml);
  const listings = ctx.hoodlefinanceExtractPseListings_(firstPageHtml);
  let pageNo;
  let html;

  for (pageNo = 2; pageNo <= stats.totalPages; pageNo += 1) {
    html = fetchTextOrThrow(ctx, PSE_SEARCH_URL + "&pageNo=" + pageNo);
    listings.push.apply(listings, ctx.hoodlefinanceExtractPseListings_(html));
  }

  return {
    listings: listings,
    totalItems: stats.totalItems,
    totalPages: stats.totalPages,
  };
}

function fetchPseQuotes(ctx, listings) {
  const quoteRecords = [];
  let listing;
  let quote;
  let html;
  let i;

  for (i = 0; i < listings.length; i += 1) {
    listing = listings[i];
    html = fetchTextOrThrow(
      ctx,
      PSE_STOCK_DATA_URL +
        "?cmpy_id=" +
        encodeURIComponent(listing.companyId) +
        "&security_id=" +
        encodeURIComponent(listing.securityId)
    );
    quote = ctx.hoodlefinanceExtractPseQuote_(html, listing);

    if (!quote || !quote.symbol || /Stock symbol not found\./i.test(html)) {
      html = fetchTextOrThrow(
        ctx,
        PSE_STOCK_DATA_URL + "?cmpy_id=" + encodeURIComponent(listing.companyId)
      );
      quote = ctx.hoodlefinanceExtractPseQuote_(html, listing);
    }

    if (!quote || !quote.symbol) {
      throw new Error("Missing PSE quote data for " + listing.symbol + ".");
    }

    quoteRecords.push({
      companyId: listing.companyId,
      isin: String(quote.isin || "").toUpperCase(),
      name: quote.longName || listing.name || "",
      securityId: listing.securityId,
      symbol: String(quote.symbol).toUpperCase(),
    });
  }

  return quoteRecords;
}

function buildIsinMap(quoteRecords) {
  const map = {};
  const conflicts = [];

  quoteRecords.forEach(function (record) {
    if (!record.isin) {
      return;
    }

    const ticker = "PSE:" + record.symbol;

    if (map[record.isin] && map[record.isin] !== ticker) {
      conflicts.push({
        existing: map[record.isin],
        isin: record.isin,
        next: ticker,
      });
      return;
    }

    map[record.isin] = ticker;
  });

  if (conflicts.length) {
    throw new Error("Found conflicting PSE ISIN mappings: " + JSON.stringify(conflicts.slice(0, 5)));
  }

  return map;
}

function sortObjectByKey(value) {
  const sorted = {};

  Object.keys(value).sort().forEach(function (key) {
    sorted[key] = value[key];
  });

  return sorted;
}

function buildOutputText(isinMap, quoteRecords, stats, updatedAt) {
  const missingIsinSymbols = quoteRecords
    .filter(function (record) {
      return !record.isin;
    })
    .map(function (record) {
      return record.symbol;
    })
    .sort();
  const dataLines = [
    "# PSE ISIN to ticker map",
    "# updated_at=" + updatedAt,
    "# total_directory_items=" + stats.totalItems,
    "# total_directory_pages=" + stats.totalPages,
    "# scraped_listings=" + quoteRecords.length,
    "# mapped_isins=" + Object.keys(isinMap).length,
    "# missing_isin_count=" + missingIsinSymbols.length,
    "# missing_isin_symbols=" + missingIsinSymbols.join(","),
    "# source_listing_search_url=" + PSE_SEARCH_URL,
    "# source_stock_data_url=" + PSE_STOCK_DATA_URL,
  ].concat(Object.keys(isinMap).sort().map(function (isin) {
    return isin + "=" + isinMap[isin];
  }));

  return dataLines.join("\n") + "\n";
}

function extractUpdatedAt(text) {
  const match = String(text || "").match(/^# updated_at=(.+)$/m);
  return match ? match[1].trim() : "";
}

function stripUpdatedAtLine(text) {
  return String(text || "").replace(/^# updated_at=.*(?:\r?\n)?/m, "").trimEnd();
}

function preserveExistingUpdatedAtIfOnlyTimestampChanged(existingText, nextText) {
  const existingUpdatedAt = extractUpdatedAt(existingText);

  if (!existingUpdatedAt || stripUpdatedAtLine(existingText) !== stripUpdatedAtLine(nextText)) {
    return nextText;
  }

  return nextText.replace(/^# updated_at=.*$/m, "# updated_at=" + existingUpdatedAt);
}

function writeOutputs(isinMap, quoteRecords, stats, options) {
  const dataPath = options && options.dataPath ? options.dataPath : DATA_PATH;
  const nextText = buildOutputText(
    isinMap,
    quoteRecords,
    stats,
    options && options.updatedAt ? String(options.updatedAt) : new Date().toISOString()
  );
  const existingText = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, "utf8") : "";
  const finalText = preserveExistingUpdatedAtIfOnlyTimestampChanged(existingText, nextText);

  if (existingText === finalText) {
    return {
      changed: false,
      path: dataPath,
    };
  }

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, finalText);
  return {
    changed: true,
    path: dataPath,
  };
}

function main() {
  const ctx = loadHoodlefinance();
  const listingInfo = fetchAllListings(ctx);
  const quoteRecords = fetchPseQuotes(ctx, listingInfo.listings);
  const isinMap = sortObjectByKey(buildIsinMap(quoteRecords));

  if (listingInfo.totalItems !== quoteRecords.length) {
    throw new Error(
      "Expected " + listingInfo.totalItems + " PSE listings but scraped " + quoteRecords.length + "."
    );
  }

  const writeResult = writeOutputs(isinMap, quoteRecords, listingInfo);
  const summary =
    Object.keys(isinMap).length +
    " PSE ISIN mappings from " +
    quoteRecords.length +
    " listings (" +
    (quoteRecords.length - Object.keys(isinMap).length) +
    " without ISIN)";

  console.log(
    writeResult.changed
      ? "Generated " + summary + " into " + writeResult.path
      : "Verified " + summary + "; no map changes for " + writeResult.path
  );
}

module.exports = {
  buildIsinMap,
  buildOutputText,
  extractUpdatedAt,
  fetchAllListings,
  fetchPseQuotes,
  loadHoodlefinance,
  preserveExistingUpdatedAtIfOnlyTimestampChanged,
  sortObjectByKey,
  stripUpdatedAtLine,
  writeOutputs,
};

if (require.main === module) {
  main();
}
