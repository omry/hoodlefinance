#!/usr/bin/env node
/* SPDX-License-Identifier: MPL-2.0 */

const {
  createHoodlefinanceRuntime,
} = require("../../dist/ts/runtime/host-adapter.js");
const {
  renderGraphAsMermaidFlowchart,
} = require("../../dist/ts/core/graph-mermaid.js");
const {
  StandAloneResolverServices,
} = require("../../dist/ts/runtime/StandAloneResolverServices.js");
const { looksLikeIsin } = require("../../dist/ts/core/request.js");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createUrlFetchApp } = require("../../tools/_shared/urlfetch-sync.js");
const CURRENCY_CODES_CACHE_KEY = "hoodlefinance:currencyCodes";
const PREFERRED_REIT_WHITELIST_CACHE_KEY =
  "hoodlefinance:ts:preferredReitWhitelist";
const GRAPH_OUTPUT_FORMATS = Object.freeze({
  ASCII: "ascii",
  MERMAID: "mermaid",
  SVG: "svg",
});
const GRAPH_RENDER_OPTIONS = Object.freeze({
  mermaidDirection: "LR",
});
const GRAPH_SVG_THEME = Object.freeze({
  accent: "#7dd3fc",
  bg: "#0f172a",
  border: "#334155",
  fg: "#e2e8f0",
  line: "#94a3b8",
  muted: "#94a3b8",
  surface: "#111827",
  transparent: true,
});
const GRAPH_BROWSER_HTML_STYLES = [
  "body{margin:0;padding:24px;background:#111827;color:#e5e7eb;font-family:monospace;}",
  "main{max-width:1200px;margin:0 auto;}",
  "h1{font-size:16px;margin:0 0 16px;}",
  "section{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:16px;overflow:auto;}",
  "svg{display:block;max-width:100%;height:auto;background:transparent;}",
].join("");

function loadTextFile(path) {
  return fs.readFileSync(path, "utf8");
}

function loadPreferredReitWhitelistText() {
  const dataPath = `${__dirname}/../../data/preferred-reit-whitelist.json`;

  return loadTextFile(dataPath);
}

function loadCurrencyCodesText() {
  const dataPath = `${__dirname}/../../data/currency-codes.json`;

  return loadTextFile(dataPath);
}

function createSyncFetcher() {
  const urlFetchApp = createUrlFetchApp();

  return (url) => {
    try {
      return urlFetchApp.fetch(url);
    } catch (error) {
      throw new Error(
        `Failed to fetch "${url}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}

function createCliEnvironment() {
  const syncFetchText = createSyncFetcher();
  const resolverServices = new StandAloneResolverServices({
    httpFetch(url) {
      return syncFetchText(url);
    },
  });
  const env = {
    getCachedString(key) {
      return resolverServices.getCachedString(key);
    },
    httpFetch(url) {
      return resolverServices.httpFetch(url);
    },
    looksLikeIsin,
  };

  resolverServices.putCachedString(
    PREFERRED_REIT_WHITELIST_CACHE_KEY,
    loadPreferredReitWhitelistText(),
    21600,
  );
  resolverServices.putCachedString(
    CURRENCY_CODES_CACHE_KEY,
    loadCurrencyCodesText(),
    21600,
  );

  const runtime = createHoodlefinanceRuntime(resolverServices);

  Object.assign(env, {
    getGraph: runtime.getGraph,
    resolveAttribute: runtime.resolveAttribute,
    resolveAttributeWithTrace: runtime.resolveAttributeWithTrace,
  });

  return env;
}

function normalizeAttribute(attribute) {
  return String(attribute == null ? "price" : attribute).trim();
}

function resolveAttributeResultWithEnvironment(env, args, options) {
  try {
    const value = env.resolveAttribute(
      args.ticker,
      normalizeAttribute(args.attribute),
      options || undefined,
    );

    if (value && typeof value.then === "function") {
      return value
        .then((resolvedValue) => ({
          error: "",
          status: "success",
          value: resolvedValue,
        }))
        .catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
          status: "failure",
          value: null,
        }));
    }

    return {
      error: "",
      status: "success",
      value,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      status: "failure",
      value: null,
    };
  }
}

function resolveAttributeTraceWithEnvironment(env, args) {
  try {
    const result = env.resolveAttributeWithTrace(
      args.ticker,
      normalizeAttribute(args.attribute),
    );

    return {
      error: "",
      failure: result.error || "",
      path: result.path,
      status: result.status,
      value: result.value,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      failure: "",
      path: [],
      status: "failure",
      value: null,
    };
  }
}

function formatResolvedValue(result) {
  return result instanceof Date
    ? result
    : result && typeof result === "object"
      ? JSON.parse(JSON.stringify(result))
      : result;
}

function renderGraphMermaidWithEnvironment(env) {
  return renderGraphAsMermaidFlowchart(env.getGraph(), {
    direction: GRAPH_RENDER_OPTIONS.mermaidDirection,
  });
}

let beautifulMermaidModulePromise = null;

async function loadBeautifulMermaidModule() {
  if (!beautifulMermaidModulePromise) {
    beautifulMermaidModulePromise = import("beautiful-mermaid");
  }

  return beautifulMermaidModulePromise;
}

function unescapeMermaidLabel(value) {
  return String(value || "")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function normalizeTextGraphLabel(value) {
  return unescapeMermaidLabel(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .trim();
}

function renderMermaidAsTextGraph(mermaidText) {
  const nodeByAlias = new Map();
  const orderedAliases = [];
  const edgesByAlias = new Map();
  const lines = String(mermaidText || "").split(/\r?\n/);
  let header = "flowchart TD";

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    if (trimmedLine.startsWith("flowchart ")) {
      header = trimmedLine;
      continue;
    }

    const nodeMatch = trimmedLine.match(/^([A-Z0-9_]+)\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      const alias = nodeMatch[1];
      const label = normalizeTextGraphLabel(nodeMatch[2]) || alias;
      nodeByAlias.set(alias, label);
      orderedAliases.push(alias);
      continue;
    }

    const edgeMatch = trimmedLine.match(/^([A-Z0-9_]+)\s+-->\s+([A-Z0-9_]+)$/);
    if (!edgeMatch) {
      continue;
    }

    const fromAlias = edgeMatch[1];
    const toAlias = edgeMatch[2];
    if (!edgesByAlias.has(fromAlias)) {
      edgesByAlias.set(fromAlias, []);
    }
    edgesByAlias.get(fromAlias).push(toAlias);
  }

  const outputLines = [header];

  for (const alias of orderedAliases) {
    const nodeLabel = nodeByAlias.get(alias);
    if (!nodeLabel) {
      continue;
    }

    outputLines.push("");
    outputLines.push(...nodeLabel.split("\n"));

    for (const childAlias of edgesByAlias.get(alias) || []) {
      const childLabel = nodeByAlias.get(childAlias) || childAlias;
      outputLines.push(`  -> ${childLabel.split("\n")[0]}`);
    }
  }

  return outputLines.join("\n");
}

function renderGraphTextWithEnvironment(env) {
  return renderMermaidAsTextGraph(renderGraphMermaidWithEnvironment(env));
}

async function renderGraphSvgWithEnvironment(env) {
  const { renderMermaidSVG } = await loadBeautifulMermaidModule();

  return renderMermaidSVG(
    renderGraphMermaidWithEnvironment(env),
    GRAPH_SVG_THEME,
  );
}

function createGraphSvgHtmlDocument(svgText) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>HOODLEFINANCE Graph</title>",
    `  <style>${GRAPH_BROWSER_HTML_STYLES}</style>`,
    "</head>",
    "<body>",
    "  <main>",
    "    <h1>HOODLEFINANCE Graph</h1>",
    "    <section>",
    svgText,
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function isWsl(runtime) {
  if (runtime && typeof runtime.isWsl === "boolean") {
    return runtime.isWsl;
  }

  const env = runtime && runtime.env ? runtime.env : process.env;

  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) {
    return true;
  }

  const release =
    runtime && typeof runtime.osRelease === "string"
      ? runtime.osRelease
      : os.release();

  if (String(release).toLowerCase().includes("microsoft")) {
    return true;
  }

  try {
    return loadTextFile("/proc/version").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function translateWslPathToWindows(filePath, runtime) {
  if (runtime && typeof runtime.translateWslPath === "function") {
    return runtime.translateWslPath(filePath);
  }

  return childProcess
    .execFileSync("wslpath", ["-w", filePath], {
      encoding: "utf8",
    })
    .trim();
}

function createBrowserOpenCommand(filePath, runtime) {
  const platform =
    runtime && typeof runtime.platform === "string"
      ? runtime.platform
      : process.platform;

  if (isWsl(runtime)) {
    return {
      args: [translateWslPathToWindows(filePath, runtime)],
      command: "explorer.exe",
      detached: false,
    };
  }

  switch (platform) {
    case "darwin":
      return {
        args: [filePath],
        command: "open",
        detached: true,
      };
    case "win32":
      return {
        args: ["/c", "start", "", filePath],
        command: "cmd",
        detached: false,
      };
    default:
      return {
        args: [filePath],
        command: "xdg-open",
        detached: true,
      };
  }
}

function openFileInBrowser(filePath) {
  return openFileInBrowserWithSpawn(filePath, childProcess.spawn);
}

function createBrowserOpenError(message, filePath) {
  return new Error(`${message}. Open this file manually: ${filePath}`);
}

function openFileInBrowserWithSpawn(filePath, spawnImpl, runtime) {
  let openCommand;

  try {
    openCommand = createBrowserOpenCommand(filePath, runtime);
  } catch (error) {
    return Promise.reject(
      createBrowserOpenError(
        `Failed to prepare browser opener: ${
          error instanceof Error ? error.message : String(error)
        }`,
        filePath,
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawnImpl(openCommand.command, openCommand.args, {
      detached: openCommand.detached,
      stdio: "ignore",
    });

    child.once("error", (error) => {
      reject(
        createBrowserOpenError(
          `Failed to open browser with "${openCommand.command}": ${
            error instanceof Error ? error.message : String(error)
          }`,
          filePath,
        ),
      );
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function writeGraphBrowserHtmlFile(svgText) {
  const filePath = path.join(
    os.tmpdir(),
    `hoodlefinance-graph-${Date.now()}.html`,
  );
  fs.writeFileSync(filePath, createGraphSvgHtmlDocument(svgText), "utf8");

  return filePath;
}

function parseGraphCommandOptions(argv) {
  const options = {
    browser: false,
    output: GRAPH_OUTPUT_FORMATS.ASCII,
  };

  for (const arg of argv) {
    if (arg === "--browser") {
      options.browser = true;
      continue;
    }

    if (arg === "--output=mermaid") {
      options.output = GRAPH_OUTPUT_FORMATS.MERMAID;
      continue;
    }

    if (arg === "--output=svg") {
      options.output = GRAPH_OUTPUT_FORMATS.SVG;
      continue;
    }

    throw new Error(`Unsupported graph option "${arg}".`);
  }

  if (options.browser && options.output !== GRAPH_OUTPUT_FORMATS.SVG) {
    throw new Error("--browser currently requires --output=svg.");
  }

  return options;
}

async function handleGraphCommand(env, argv) {
  const options = parseGraphCommandOptions(argv);

  if (options.output === GRAPH_OUTPUT_FORMATS.MERMAID) {
    return renderGraphMermaidWithEnvironment(env);
  }

  if (options.output === GRAPH_OUTPUT_FORMATS.SVG) {
    const svgText = await renderGraphSvgWithEnvironment(env);

    if (options.browser) {
      const htmlFilePath = writeGraphBrowserHtmlFile(svgText);
      await openFileInBrowser(htmlFilePath);
      return `Opened graph in browser: ${htmlFilePath}`;
    }

    return svgText;
  }

  return renderGraphTextWithEnvironment(env);
}

function runSmokeSuite(env = createCliEnvironment()) {
  const cases = [
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected GOOG to return a live quote");
        }
      },
      ticker: "GOOG",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (result.value !== 1) {
          throw new Error("expected USDUSD to resolve to a 1.0 quote");
        }
      },
      ticker: "USDUSD",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected EURUSD to return a live quote");
        }
      },
      ticker: "EURUSD",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected Yahoo ISIN lookup to return a live quote");
        }
      },
      ticker: "US02079K1079",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error(
            "expected PSE ISIN map lookup to return a live quote",
          );
        }
      },
      ticker: "PHY077751022",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error(
            "expected TradingView fallback to return a live quote",
          );
        }
      },
      ticker: "TLV:KSMF59",
    },
    {
      attribute: "price",
      expected(result) {
        if (result.status !== "success") {
          throw new Error(`expected success, got ${result.status}`);
        }

        if (!Number.isFinite(result.value)) {
          throw new Error("expected PSE lookup to return a live quote");
        }
      },
      ticker: "PSE:BDO",
    },
  ];
  const failures = [];

  for (const smokeCase of cases) {
    try {
      smokeCase.expected(
        resolveAttributeResultWithEnvironment(env, {
          attribute: smokeCase.attribute,
          ticker: smokeCase.ticker,
        }),
      );
    } catch (error) {
      failures.push(
        `${smokeCase.ticker} ${smokeCase.attribute}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    failures,
    passed: cases.length - failures.length,
    total: cases.length,
  };
}

function printUsage() {
  console.error("Usage: npm run hoodlefinance.ts -- <ticker> [attribute]");
  console.error(
    "       npm run hoodlefinance.ts -- --graph [--output=mermaid|svg] [--browser]",
  );
  console.error(
    "       npm run hoodlefinance.ts -- --trace-route <ticker> [attribute]",
  );
  console.error("       npm run hoodlefinance.ts -- --mermaid");
  console.error("       npm run smoke.ts -- --smoke");
}

async function main(argv = process.argv.slice(2)) {
  const [firstArg, secondArg, thirdArg] = argv;
  let env = null;
  function getEnv() {
    if (!env) {
      env = createCliEnvironment();
    }

    return env;
  }

  if (!firstArg) {
    printUsage();
    process.exit(1);
  }

  if (firstArg === "--smoke") {
    const smoke = runSmokeSuite(getEnv());

    for (const failure of smoke.failures) {
      console.error(failure);
    }

    console.log(`smoke: ${smoke.passed}/${smoke.total} passed`);
    process.exit(smoke.failures.length ? 1 : 0);
  }

  if (firstArg === "--graph") {
    console.log(await handleGraphCommand(getEnv(), argv.slice(1)));
    return;
  }

  if (firstArg === "--trace-route") {
    if (!secondArg) {
      printUsage();
      process.exit(1);
    }

    const traced = resolveAttributeTraceWithEnvironment(getEnv(), {
      attribute: thirdArg,
      ticker: secondArg,
    });

    console.log(
      JSON.stringify(
        {
          ...(traced.failure ? { error: traced.failure } : {}),
          path: traced.path,
          status: traced.status,
          value: formatResolvedValue(traced.value),
        },
        null,
        2,
      ),
    );

    if (traced.status !== "success") {
      process.exit(1);
    }

    return;
  }

  if (firstArg === "--mermaid") {
    console.log(renderGraphMermaidWithEnvironment(getEnv()));
    return;
  }

  if (firstArg.startsWith("--")) {
    printUsage();
    process.exit(1);
  }

  let result;

  try {
    result = getEnv().resolveAttribute(firstArg, normalizeAttribute(secondArg));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const formattedResult = formatResolvedValue(result);

  if (formattedResult instanceof Date) {
    console.log(formattedResult.toISOString());
    return;
  }

  console.log(formattedResult);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  createBrowserOpenCommand,
  createCliEnvironment,
  createGraphSvgHtmlDocument,
  handleGraphCommand,
  parseGraphCommandOptions,
  resolveAttributeResultWithEnvironment,
  resolveAttributeTraceWithEnvironment,
  renderGraphMermaidWithEnvironment,
  renderGraphSvgWithEnvironment,
  renderGraphTextWithEnvironment,
  renderMermaidAsTextGraph,
  writeGraphBrowserHtmlFile,
  main,
  openFileInBrowser,
  openFileInBrowserWithSpawn,
  runSmokeSuite,
};
