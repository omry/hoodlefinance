#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const vm = require("vm");

const DEFAULT_TICKERS = [
  "GOOG",
  "AAPL",
  "MSFT",
  "AMZN",
  "META",
  "NVDA",
  "TSLA",
  "BRK-B",
  "LLY",
  "JPM",
  "V",
  "MA",
  "UNH",
  "XOM",
  "HD",
  "COST",
  "PG",
  "JNJ",
  "ABBV",
  "BAC",
  "CVX",
  "MRK",
  "KO",
  "AVGO",
  "PEP",
  "ADBE",
  "CSCO",
  "WMT",
  "CRM",
  "NFLX",
  "AMD",
  "ACN",
  "TMO",
  "ORCL",
  "QCOM",
  "MCD",
  "DIS",
  "ABT",
  "GE",
  "INTU",
  "CAT",
  "IBM",
  "LIN",
  "NOW",
  "AMGN",
  "TXN",
  "GS",
  "MS",
  "SPGI",
  "BLK",
];

const SUPPORTED_ATTRIBUTES = {
  change: true,
  changepct: true,
  close: true,
  currency: true,
  datadelay: true,
  high: true,
  low: true,
  name: true,
  price: true,
  tradetime: true,
  volume: true,
};

const SOURCE_ORDER = [
  "yahoo-isin-search",
  "yahoo-chart",
  "pse-search",
  "pse-stock",
];

function parseArgs(argv) {
  const options = {
    attribute: "price",
    count: 20,
    tickers: [],
  };
  let i;

  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--attribute" && argv[i + 1]) {
      options.attribute = argv[i + 1];
      i += 1;
      continue;
    }

    if (argv[i] === "--count" && argv[i + 1]) {
      options.count = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (argv[i] === "--tickers" && argv[i + 1]) {
      options.tickers = argv[i + 1]
        .split(",")
        .map(function (value) {
          return String(value || "").trim();
        })
        .filter(Boolean);
      i += 1;
      continue;
    }

    if (argv[i] === "--help" || argv[i] === "-h") {
      printUsage(0);
    }

    printUsage(1, "Unknown argument: " + argv[i]);
  }

  options.attribute = String(options.attribute || "price")
    .trim()
    .toLowerCase();

  if (!SUPPORTED_ATTRIBUTES[options.attribute]) {
    printUsage(
      1,
      "Only quote-backed attributes are supported by the benchmark: " +
        Object.keys(SUPPORTED_ATTRIBUTES).join(", "),
    );
  }

  if (!options.tickers.length) {
    if (
      !options.count ||
      options.count < 1 ||
      options.count > DEFAULT_TICKERS.length
    ) {
      printUsage(1, "--count must be between 1 and " + DEFAULT_TICKERS.length);
    }
    options.tickers = DEFAULT_TICKERS.slice(0, options.count);
  }

  return options;
}

function printUsage(exitCode, error) {
  if (error) {
    console.error(error);
  }

  console.error(
    "Usage: node tools/_shared/benchmark.js [--attribute <attribute>] [--count <n>] [--tickers <csv>]",
  );
  console.error(
    "Example: node tools/_shared/benchmark.js --attribute price --count 20",
  );
  process.exit(exitCode);
}

function loadHelpers() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "hoodlefinance.js"),
    "utf8",
  );
  const sandbox = {
    console,
    Date,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
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
    UrlFetchApp: {
      fetch() {
        throw new Error(
          "Benchmark helper should not call UrlFetchApp.fetch directly.",
        );
      },
      fetchAll() {
        throw new Error(
          "Benchmark helper should not call UrlFetchApp.fetchAll directly.",
        );
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "hoodlefinance.js" });
  return sandbox;
}

function createStats() {
  return {
    requestsBySource: {},
    totalRequests: 0,
  };
}

function recordBatch(stats, source, size) {
  if (!stats.requestsBySource[source]) {
    stats.requestsBySource[source] = {
      batches: 0,
      chunkSizes: [],
      requests: 0,
    };
  }

  stats.requestsBySource[source].batches += 1;
  stats.requestsBySource[source].chunkSizes.push(size);
  stats.requestsBySource[source].requests += size;
  stats.totalRequests += size;
}

function fetchText(url) {
  const parsedUrl = new URL(url);
  const transport = parsedUrl.protocol === "http:" ? http : https;

  return new Promise(function (resolve, reject) {
    const request = transport.request(
      {
        headers: {
          "Accept-Encoding": "identity",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0",
        },
        hostname: parsedUrl.hostname,
        method: "GET",
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || undefined,
        protocol: parsedUrl.protocol,
      },
      function (response) {
        const chunks = [];

        response.on("data", function (chunk) {
          chunks.push(chunk);
        });

        response.on("end", function () {
          const body = Buffer.concat(chunks).toString("utf8");

          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers &&
            response.headers.location
          ) {
            resolve(
              fetchText(
                new URL(response.headers.location, parsedUrl).toString(),
              ),
            );
            return;
          }

          resolve({
            body: body,
            statusCode: response.statusCode || 0,
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function fetchBatches(source, urls, stats, concurrency) {
  const results = [];
  let index;
  let chunk;

  for (index = 0; index < urls.length; index += concurrency) {
    chunk = urls.slice(index, index + concurrency);
    recordBatch(stats, source, chunk.length);
    results.push.apply(results, await Promise.all(chunk.map(fetchText)));
  }

  return results;
}

function classifyJob(helpers, ticker, attribute) {
  return {
    attribute: attribute,
    error: "",
    key: String(ticker).trim() + "\n" + attribute,
    plan: helpers.hoodlefinanceClassifyTickerJob_(ticker),
    quote: null,
    tickerInput: String(ticker).trim(),
    value: null,
  };
}

async function resolveScalarJobs(helpers, tickers, attribute, concurrency) {
  const stats = createStats();
  const jobs = [];
  let i;

  for (i = 0; i < tickers.length; i += 1) {
    jobs.push(classifyJob(helpers, tickers[i], attribute));
    await resolveJobsWithSourcePipeline(
      helpers,
      [jobs[jobs.length - 1]],
      stats,
      concurrency,
    );
  }

  return {
    jobs: jobs,
    stats: stats,
  };
}

async function resolveRangeJobs(helpers, tickers, attribute, concurrency) {
  const stats = createStats();
  const jobByKey = {};
  const orderedJobs = [];
  let i;
  let job;

  for (i = 0; i < tickers.length; i += 1) {
    job = classifyJob(helpers, tickers[i], attribute);

    if (!jobByKey[job.key]) {
      jobByKey[job.key] = job;
      orderedJobs.push(job);
    }
  }

  await resolveJobsWithSourcePipeline(helpers, orderedJobs, stats, concurrency);
  return {
    jobs: orderedJobs,
    stats: stats,
  };
}

async function resolveJobsWithSourcePipeline(
  helpers,
  jobs,
  stats,
  concurrency,
) {
  let i;
  let source;

  for (i = 0; i < jobs.length; i += 1) {
    if (jobs[i].plan.source === "local-fx") {
      jobs[i].quote = helpers.hoodlefinanceBuildSameCurrencyQuote_(
        jobs[i].plan.sameCurrencyPair,
      );
    }
  }

  for (i = 0; i < SOURCE_ORDER.length; i += 1) {
    source = SOURCE_ORDER[i];

    if (source === "yahoo-isin-search") {
      await resolveYahooIsinJobs(helpers, jobs, stats, concurrency);
      continue;
    }

    if (source === "yahoo-chart") {
      await resolveYahooChartJobs(helpers, jobs, stats, concurrency);
      continue;
    }

    if (source === "pse-search") {
      await resolvePseSearchJobs(helpers, jobs, stats, concurrency);
      continue;
    }

    if (source === "pse-stock") {
      await resolvePseStockJobs(helpers, jobs, stats, concurrency);
    }
  }

  for (i = 0; i < jobs.length; i += 1) {
    if (jobs[i].error) {
      throw new Error(jobs[i].error);
    }

    jobs[i].value = helpers.hoodlefinanceExtractAttribute_(
      jobs[i].quote,
      jobs[i].attribute,
      { tickerInput: jobs[i].tickerInput },
    );
  }
}

async function resolveYahooIsinJobs(helpers, jobs, stats, concurrency) {
  const targets = jobs.filter(function (job) {
    return (
      !job.error &&
      job.plan.source === "yahoo-isin-search" &&
      !job.plan.yahooSymbol
    );
  });
  let responses;
  let i;

  if (!targets.length) {
    return;
  }

  responses = await fetchBatches(
    "yahoo-isin-search",
    targets.map(function (job) {
      return helpers.hoodlefinanceBuildYahooIsinSearchUrl_(job.plan.isin);
    }),
    stats,
    concurrency,
  );

  for (i = 0; i < targets.length; i += 1) {
    try {
      if (responses[i].statusCode !== 200) {
        throw new Error(
          'ISIN lookup failed for "' +
            targets[i].plan.isin +
            '" (' +
            responses[i].statusCode +
            ").",
        );
      }

      targets[i].plan.yahooSymbol =
        helpers.hoodlefinanceExtractYahooSymbolFromSearchPayload_(
          JSON.parse(responses[i].body),
          targets[i].plan.isin,
        );
    } catch (error) {
      targets[i].error = error && error.message ? error.message : String(error);
    }
  }
}

async function resolveYahooChartJobs(helpers, jobs, stats, concurrency) {
  const targets = jobs.filter(function (job) {
    return (
      !job.error &&
      !job.quote &&
      (job.plan.source === "yahoo-chart" || job.plan.yahooSymbol)
    );
  });
  let responses;
  let i;

  if (!targets.length) {
    return;
  }

  responses = await fetchBatches(
    "yahoo-chart",
    targets.map(function (job) {
      return helpers.hoodlefinanceBuildYahooChartUrl_(job.plan.yahooSymbol);
    }),
    stats,
    concurrency,
  );

  for (i = 0; i < targets.length; i += 1) {
    try {
      if (responses[i].statusCode !== 200) {
        throw new Error(
          "Quote lookup failed for " +
            targets[i].tickerInput +
            " (" +
            responses[i].statusCode +
            ").",
        );
      }

      targets[i].quote = helpers.hoodlefinanceExtractYahooQuoteMetaFromPayload_(
        JSON.parse(responses[i].body),
        targets[i].tickerInput,
      );
    } catch (error) {
      targets[i].error = error && error.message ? error.message : String(error);
    }
  }
}

async function resolvePseSearchJobs(helpers, jobs, stats, concurrency) {
  const targets = jobs.filter(function (job) {
    return !job.error && job.plan.source === "pse" && !job.plan.listing;
  });
  let responses;
  let i;

  if (!targets.length) {
    return;
  }

  responses = await fetchBatches(
    "pse-search",
    targets.map(function (job) {
      return (
        "https://edge.pse.com.ph/companyDirectory/search.ax?keyword=" +
        encodeURIComponent(job.plan.symbol)
      );
    }),
    stats,
    concurrency,
  );

  for (i = 0; i < targets.length; i += 1) {
    try {
      targets[i].plan.listing = helpers.hoodlefinanceResolvePseListingFromHtml_(
        responses[i].statusCode === 200 ? responses[i].body : "",
        targets[i].plan.symbol,
      );
    } catch (error) {
      targets[i].error = error && error.message ? error.message : String(error);
    }
  }
}

async function resolvePseStockJobs(helpers, jobs, stats, concurrency) {
  const targets = jobs.filter(function (job) {
    return (
      !job.error && job.plan.source === "pse" && job.plan.listing && !job.quote
    );
  });
  let responses;
  let i;
  let quote;

  if (!targets.length) {
    return;
  }

  responses = await fetchBatches(
    "pse-stock",
    targets.map(function (job) {
      return (
        "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=" +
        encodeURIComponent(job.plan.listing.companyId) +
        "&security_id=" +
        encodeURIComponent(job.plan.listing.securityId)
      );
    }),
    stats,
    concurrency,
  );

  for (i = 0; i < targets.length; i += 1) {
    try {
      quote = helpers.hoodlefinanceExtractPseQuote_(
        responses[i].statusCode === 200 ? responses[i].body : "",
        targets[i].plan.listing,
      );

      if (!quote || !quote.symbol) {
        throw new Error(
          "No PSE quote data was found for " + targets[i].tickerInput + ".",
        );
      }

      targets[i].quote = quote;
    } catch (error) {
      targets[i].error = error && error.message ? error.message : String(error);
    }
  }
}

async function benchmark(label, fn) {
  const startedAt = Date.now();
  const resolved = await fn();

  return {
    label: label,
    ms: Date.now() - startedAt,
    resolvedJobs: resolved.jobs.length,
    stats: resolved.stats,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const helpers = loadHelpers();
  const concurrency = 50;
  const scalar = await benchmark("scalar", function () {
    return resolveScalarJobs(
      helpers,
      options.tickers,
      options.attribute,
      concurrency,
    );
  });
  const range = await benchmark("range", function () {
    return resolveRangeJobs(
      helpers,
      options.tickers,
      options.attribute,
      concurrency,
    );
  });

  console.log(
    JSON.stringify(
      {
        attribute: options.attribute,
        concurrency: concurrency,
        range: range,
        scalar: scalar,
        speedup: Number((scalar.ms / Math.max(range.ms, 1)).toFixed(2)),
        tickerCount: options.tickers.length,
      },
      null,
      2,
    ),
  );
}

main().catch(function (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
