const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  createBrowserOpenCommand,
  createGraphSvgHtmlDocument,
  handleGraphCommand,
  openFileInBrowserWithSpawn,
  parseGraphCommandOptions,
  resolveAttributeResultWithEnvironment,
  resolveAttributeTraceWithEnvironment,
  renderGraphMermaidWithEnvironment,
  renderGraphSvgWithEnvironment,
  renderGraphTextWithEnvironment,
  renderMermaidAsTextGraph,
  runSmokeSuite,
} = require("../tools/_shared/cli-ts.js");

function createFakeLookupEnv() {
  return {
    resolveAttribute(identifier, attribute) {
      const ticker = String(identifier || "")
        .trim()
        .toUpperCase();
      const normalizedAttribute = String(
        attribute == null ? "price" : attribute,
      ).trim();

      if (ticker === "GOOG") {
        return normalizedAttribute === "isin" ? "US02079K1079" : 123.45;
      }

      if (ticker === "EURUSD") {
        return 1.25;
      }

      if (ticker === "USDUSD") {
        return 1;
      }

      if (ticker === "US02079K1079" || ticker === "PHY077751022") {
        return 123.45;
      }

      if (ticker === "TLV:KSMF59" || ticker === "PSE:BDO") {
        return ticker === "TLV:KSMF59" ? 17.25 : 9.87;
      }

      throw new Error(`not found: ${ticker}`);
    },
    resolveAttributeWithTrace(identifier, attribute) {
      const value = this.resolveAttribute(identifier, attribute);
      return {
        error: "",
        path: ["ROOT", "ATTRIBUTE", "QUOTE:TICKER", "YAHOO-QUOTE", "EXTRACT:EQUITY", "TERMINAL"],
        status: "success",
        value,
      };
    },
  };
}

function createFakeGraphEnv() {
  const definition = {
    ROOT: {
      id: "ROOT",
      next: ["QUOTE"],
      type: "RoutingPlan",
    },
    QUOTE: {
      id: "QUOTE",
      next: ["TERMINAL"],
      type: "YahooQuoteResolver",
    },
    TERMINAL: {
      id: "TERMINAL",
      type: "TerminalCollectorPlan",
    },
  };
  const order = ["ROOT", "QUOTE", "TERMINAL"].map((id) => definition[id]);

  return {
    getGraph() {
      return {
        definition,
        getChildren(id) {
          const node = definition[id] || null;

          return (node && node.next ? node.next : []).map(
            (childId) => definition[childId],
          );
        },
        getNode(id) {
          return definition[id] || null;
        },
        getParents(id) {
          return order.filter((node) => (node.next || []).includes(id));
        },
        getRoot() {
          return definition.ROOT;
        },
        getTerminal() {
          return definition.TERMINAL;
        },
        getTopologicalOrder() {
          return order.slice();
        },
        getSubgraph() {
          return null;
        },
        getSubgraphIds() {
          return [];
        },
      };
    },
  };
}

test("resolveAttributeResultWithEnvironment normalizes the attribute and delegates to env.resolveAttribute", () => {
  let receivedArgs = null;
  const env = {
    resolveAttribute(identifier, attribute) {
      receivedArgs = { attribute, identifier };
      return 123.45;
    },
  };

  const result = resolveAttributeResultWithEnvironment(env, {
    attribute: "  price  ",
    ticker: "GOOG",
  });

  assert.deepEqual(receivedArgs, {
    attribute: "price",
    identifier: "GOOG",
  });
  assert.equal(result.status, "success");
  assert.equal(result.value, 123.45);
});

test("resolveAttributeTraceWithEnvironment delegates to env.resolveAttributeWithTrace", () => {
  const result = resolveAttributeTraceWithEnvironment(createFakeLookupEnv(), {
    attribute: "  isin  ",
    ticker: "GOOG",
  });

  assert.equal(result.status, "success");
  assert.equal(result.value, "US02079K1079");
  assert.equal(result.failure, "");
  assert.deepEqual(result.path, [
    "ROOT",
    "ATTRIBUTE",
    "QUOTE:TICKER",
    "YAHOO-QUOTE",
    "EXTRACT:EQUITY",
    "TERMINAL",
  ]);
});

test("resolveAttributeTraceWithEnvironment preserves a user-facing failure message", () => {
  const result = resolveAttributeTraceWithEnvironment(
    {
      resolveAttributeWithTrace() {
        return {
          error: 'No LON ISIN is available for "SJPA".',
          path: ["ROOT", "ATTRIBUTE", "ATTRIBUTE:EQUITY", "QUOTE:TICKER", "LON-ISIN"],
          status: "failure",
          value: null,
        };
      },
    },
    {
      attribute: "isin",
      ticker: "LON:SJPA",
    },
  );

  assert.equal(result.status, "failure");
  assert.equal(result.failure, 'No LON ISIN is available for "SJPA".');
  assert.deepEqual(result.path, [
    "ROOT",
    "ATTRIBUTE",
    "ATTRIBUTE:EQUITY",
    "QUOTE:TICKER",
    "LON-ISIN",
  ]);
});

test("runSmokeSuite validates the supported CLI smoke cases", () => {
  const smoke = runSmokeSuite(createFakeLookupEnv());

  assert.equal(smoke.failures.length, 0);
  assert.equal(smoke.passed, smoke.total);
});

test("renderGraphMermaidWithEnvironment renders the Graph.View as Mermaid", () => {
  const mermaid = renderGraphMermaidWithEnvironment(createFakeGraphEnv());

  assert.match(mermaid, /^flowchart LR/m);
  assert.match(mermaid, /N0\["ROOT<br\/>RoutingPlan"\]/);
  assert.match(mermaid, /N1\["QUOTE<br\/>YahooQuoteResolver"\]/);
  assert.match(mermaid, /N0 --> N1/);
});

test("renderMermaidAsTextGraph renders a lightweight text projection", () => {
  const text = renderMermaidAsTextGraph(`flowchart TD
  N0["ROOT<br/>RoutingPlan"]
  N1["QUOTE<br/>YahooQuoteResolver"]
  N2["TERMINAL<br/>TerminalCollectorPlan"]
  N0 --> N1
  N1 --> N2`);

  assert.match(text, /^flowchart TD/m);
  assert.match(text, /\nROOT\nRoutingPlan\n  -> QUOTE/);
  assert.match(text, /\nQUOTE\nYahooQuoteResolver\n  -> TERMINAL/);
  assert.match(text, /\nTERMINAL\nTerminalCollectorPlan/);
});

test("renderGraphTextWithEnvironment renders the Mermaid graph as lightweight text", () => {
  const text = renderGraphTextWithEnvironment(createFakeGraphEnv());

  assert.match(text, /^flowchart LR/m);
  assert.match(text, /\nROOT\nRoutingPlan\n  -> QUOTE/);
  assert.match(text, /\nTERMINAL\nTerminalCollectorPlan/);
});

test("renderGraphSvgWithEnvironment renders the Mermaid graph as SVG", async () => {
  const svg = await renderGraphSvgWithEnvironment(createFakeGraphEnv());

  assert.match(svg, /^<svg\b/);
  assert.match(svg, /ROOT/);
  assert.match(svg, /QUOTE/);
  assert.match(svg, /TERMINAL/);
});

test("parseGraphCommandOptions defaults to lightweight text output", () => {
  assert.deepEqual(parseGraphCommandOptions([]), {
    browser: false,
    output: "ascii",
  });
});

test("parseGraphCommandOptions accepts Mermaid and SVG output selectors", () => {
  assert.deepEqual(parseGraphCommandOptions(["--output=mermaid"]), {
    browser: false,
    output: "mermaid",
  });
  assert.deepEqual(parseGraphCommandOptions(["--output=svg"]), {
    browser: false,
    output: "svg",
  });
});

test("parseGraphCommandOptions rejects browser mode without SVG output", () => {
  assert.throws(
    () => parseGraphCommandOptions(["--browser"]),
    /requires --output=svg/i,
  );
});

test("handleGraphCommand returns Mermaid output when requested", async () => {
  const output = await handleGraphCommand(createFakeGraphEnv(), [
    "--output=mermaid",
  ]);

  assert.match(output, /^flowchart LR/m);
});

test("handleGraphCommand returns SVG output when requested", async () => {
  const output = await handleGraphCommand(createFakeGraphEnv(), [
    "--output=svg",
  ]);

  assert.match(output, /^<svg\b/);
});

test("createGraphSvgHtmlDocument wraps the SVG in a browser document", () => {
  const document = createGraphSvgHtmlDocument("<svg>graph</svg>");

  assert.match(document, /<!doctype html>/i);
  assert.match(document, /<svg>graph<\/svg>/);
  assert.match(document, /HOODLEFINANCE Graph/);
});

test("createBrowserOpenCommand chooses a platform-specific opener", () => {
  const openCommand = createBrowserOpenCommand("/tmp/graph.html", {
    env: {},
    isWsl: false,
    osRelease: "6.8.0-generic",
    platform: "linux",
    translateWslPath() {
      throw new Error("should not translate a plain Linux path");
    },
  });

  assert.equal(openCommand.command, "xdg-open");
  assert.deepEqual(openCommand.args, ["/tmp/graph.html"]);
  assert.equal(openCommand.detached, true);
});

test("createBrowserOpenCommand detects WSL and uses a Windows opener", () => {
  const openCommand = createBrowserOpenCommand("/tmp/graph.html", {
    env: {
      WSL_DISTRO_NAME: "Ubuntu",
    },
    isWsl: true,
    platform: "linux",
    translateWslPath(filePath) {
      assert.equal(filePath, "/tmp/graph.html");
      return "C:\\temp\\graph.html";
    },
  });

  assert.equal(openCommand.command, "explorer.exe");
  assert.deepEqual(openCommand.args, ["C:\\temp\\graph.html"]);
  assert.equal(openCommand.detached, false);
});

test("openFileInBrowserWithSpawn surfaces missing opener failures clearly", async () => {
  await assert.rejects(
    () =>
      openFileInBrowserWithSpawn("/tmp/graph.html", () => {
        const child = new EventEmitter();
        child.unref = () => {};
        process.nextTick(() => {
          const error = new Error("spawn xdg-open ENOENT");
          error.code = "ENOENT";
          child.emit("error", error);
        });
        return child;
      }),
    /Open this file manually: \/tmp\/graph\.html/,
  );
});

test("openFileInBrowserWithSpawn surfaces WSL path-translation failures clearly", async () => {
  await assert.rejects(
    () =>
      openFileInBrowserWithSpawn(
        "/tmp/graph.html",
        () => {
          throw new Error("spawn should not be called");
        },
        {
          env: {
            WSL_DISTRO_NAME: "Ubuntu",
          },
          isWsl: true,
          platform: "linux",
          translateWslPath() {
            throw new Error("wslpath ENOENT");
          },
        },
      ),
    /Failed to prepare browser opener: wslpath ENOENT.*Open this file manually: \/tmp\/graph\.html/,
  );
});
