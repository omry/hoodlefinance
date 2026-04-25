/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  formatRoutingPlanTree,
  formatRoutingTable,
  formatTraceResultSummary,
  formatTraceOutput,
  formatRoutingTrace,
  getRoutingPlanTree,
  getRoutingTableRows,
  loadHoodlefinance,
  traceRoutingForSymbol,
} = require("../tools/_shared/cli.js");

test("routing table rows cover the current quote classifications", function () {
  assert.equal(
    JSON.stringify(getRoutingTableRows()),
    JSON.stringify([
      {
        classification: "equity",
        example: "GOOG",
        route: "EQUITY -> TICKER -> YAHOO",
      },
      {
        classification: "equity",
        example: "TLV:KSMF59",
        route: "EQUITY -> TICKER -> YAHOO -> TRADINGVIEW",
      },
      { classification: "fx", example: "EURUSD", route: "FX -> GOOGLE -> YAHOO" },
      {
        classification: "fx",
        example: "USDUSD",
        route: "FX -> LOCAL",
      },
      {
        classification: "equity",
        example: "PSE:BDO",
        route: "EQUITY -> PSE -> PSE-FRAMES -> PSE-EDGE",
      },
      {
        classification: "isin",
        example: "US02079K1079",
        route: "IDENTIFIER:ISIN -> YAHOO-ISIN",
      },
    ]),
  );
});

test("routing table formatter emits a readable header and rows", function () {
  const output = formatRoutingTable(getRoutingTableRows());

  assert.match(output, /^classification\texample\tplanned route/m);
  assert.match(output, /equity\tGOOG\tEQUITY -> TICKER -> YAHOO/);
  assert.match(
    output,
    /equity\tTLV:KSMF59\tEQUITY -> TICKER -> YAHOO -> TRADINGVIEW/,
  );
  assert.match(
    output,
    /equity\tPSE:BDO\tEQUITY -> PSE -> PSE-FRAMES -> PSE-EDGE/,
  );
});

test("routing plan tree renders the current plan hierarchy", function () {
  assert.deepEqual(JSON.parse(JSON.stringify(getRoutingPlanTree())), {
    label: "ROOT",
    children: [
      {
        label: "DEFAULT ATTRIBUTE",
        children: [
          {
            label: "EQUITY",
            children: [
              {
                label: "PSE",
                children: [
                  {
                    label: "PSE-FRAMES - PSE frames quote lookup",
                    children: [],
                  },
                  {
                    label: "PSE-EDGE - PSE edge quote lookup",
                    children: [],
                  },
                ],
              },
              {
                label: "TICKER",
                children: [
                  {
                    label: "YAHOO - Yahoo quote lookup",
                    children: [],
                  },
                  {
                    label: "TRADINGVIEW-FUND - TradingView fund quote lookup",
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            label: "FX",
            children: [
              {
                label: "FX-SAME",
                children: [
                  {
                    label: "LOCAL - Same-currency FX identity rate",
                    children: [],
                  },
                ],
              },
              {
                label: "FX",
                children: [
                  {
                    label: "GOOGLE - Google Finance FX quote lookup",
                    children: [],
                  },
                  {
                    label: "YAHOO - Yahoo quote lookup",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "IDENTIFIER",
        children: [
          {
            label: "IDENTIFIER:ISIN",
            children: [
              {
                label: "PSE-MAP - PSE ISIN map lookup",
                children: [],
              },
              {
                label: "YAHOO-ISIN - Yahoo search by ISIN",
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "ISIN ATTRIBUTE",
        children: [
          {
            label: "ISIN-SOURCE",
            children: [
              {
                label: "ARIVA - ARIVA ISIN lookup",
                children: [],
              },
              {
                label: "IBKR - IBKR contract search ISIN lookup",
                children: [],
              },
              {
                label: "LON - LSE search ISIN lookup",
                children: [],
              },
              {
                label: "PSE - PSE quote ISIN lookup",
                children: [],
              },
              {
                label: "TRADINGVIEW - TradingView symbol page ISIN lookup",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  });
});

test("routing plan tree formatter emits a tree-style plan rendering", function () {
  const output = formatRoutingPlanTree(getRoutingPlanTree());

  assert.match(output, /^ROOT$/m);
  assert.match(output, /^├── DEFAULT ATTRIBUTE$/m);
  assert.match(output, /^│   ├── EQUITY$/m);
  assert.match(output, /^│   │   ├── PSE$/m);
  assert.match(
    output,
    /^│   │   │   ├── PSE-FRAMES - PSE frames quote lookup$/m,
  );
  assert.match(output, /^├── IDENTIFIER$/m);
  assert.match(
    output,
    /^│       └── FX[\s\S]*GOOGLE - Google Finance FX quote lookup[\s\S]*YAHOO - Yahoo quote lookup/m,
  );
  assert.doesNotMatch(output, /@YAHOO|@GOOGLE|@PSE/);
});

test("routing trace formatter emits a readable attempted-source chain", function () {
  assert.equal(
    formatRoutingTrace({
      runtimeTrace: [
        { elapsedMs: 12, label: "YAHOO", status: "lookup_failure" },
        { elapsedMs: 34, label: "TRADINGVIEW", status: "success" },
      ],
    }),
    "YAHOO [lookup_failure, 12ms] -> TRADINGVIEW [success, 34ms]",
  );
  assert.equal(formatRoutingTrace({ runtimeTrace: [] }), "(no runtime trace)");
});

test("trace result summary reports total time and conditional slack", function () {
  assert.equal(
    formatTraceResultSummary({
      totalElapsedMs: 100,
      runtimeTrace: [{ elapsedMs: 99, label: "YAHOO", status: "success" }],
    }),
    "100ms total",
  );
  assert.equal(
    formatTraceResultSummary({
      totalElapsedMs: 100,
      runtimeTrace: [{ elapsedMs: 80, label: "YAHOO", status: "success" }],
    }),
    "100ms total, 20ms slack",
  );
});

test("trace output includes the planned route and runtime trace summary", function () {
  const fakeCtx = {
    hf_createQuoteRouteJob_(ticker, attribute) {
      return {
        attribute,
        error: null,
        key: ticker + "\n" + attribute,
        quote: null,
        tickerInput: ticker,
        value: null,
        valueResolved: false,
      };
    },
    hf_classifyTickerJob_() {
      return {
        nodes: [{ name: "YAHOO", traceLabel: "YAHOO" }],
        routeClass: "TICKER",
        routePath: "YAHOO",
        routeState: { yahooSymbol: "GOOG" },
      };
    },
    hf_cloneRouteState_(state) {
      return Object.assign({}, state);
    },
    hf_prepareRouteJob_(job, plan) {
      job.plan = plan;
      job.routeNodes = (plan.nodes || []).slice();
      job.routeState = this.hf_cloneRouteState_(plan.routeState || {});
      job.routeRuntimeTrace = [];
      job.routeLastLookupFailure = "";
    },
    hf_describePlanSource_(plan) {
      return [plan.routeClass, plan.routePath].filter(Boolean).join(" -> ");
    },
    hf_executeRouteJobs_(jobs) {
      jobs[0].routeRuntimeTrace.push({
        elapsedMs: 17,
        label: "YAHOO",
        status: "success",
      });
      jobs[0].quote = { regularMarketPrice: 1 };
    },
  };
  const output = formatTraceOutput("GOOG", "price", fakeCtx);

  assert.match(output, /^symbol: GOOG/m);
  assert.match(output, /^attribute: price$/m);
  assert.match(output, /planned route: TICKER -> YAHOO/);
  assert.match(output, /runtime trace: YAHOO \[success, 17ms\]/);
  assert.match(output, /result: success \(\d+ms total(?:, \d+ms slack)?\)/);
});

test("CLI seeds the local PSE ISIN map for direct PSE ISIN resolution", function () {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_resolveIsin_("PHY1001D1010"), "PSE:AREIT");
  assert.equal(ctx.hf_resolveIsin_("PH0000056814"), "PSE:ACPAR");
  assert.equal(ctx.hf_resolveIsin_("PHY2105Y1166"), "PSE:DDPR");
});

test("CLI seeds the local preferred REIT whitelist for smoke lookups", function () {
  const ctx = loadHoodlefinance();
  const storedPayload = JSON.parse(
    ctx.PropertiesService.getScriptProperties().getProperty(
      "hoodlefinance.preferredReitWhitelist",
    ),
  );
  const localWhitelist = fs.readFileSync(
    path.join(__dirname, "..", "data", "preferred-reit-whitelist.json"),
    "utf8",
  );

  assert.equal(typeof storedPayload.fetchedAtMs, "number");
  assert.equal(storedPayload.text, localWhitelist);
});

test("CLI prefers the local Yahoo fallback symbol for whitelisted REITs", function () {
  const ctx = loadHoodlefinance();
  const plan = ctx.hf_classifyTickerJob_("NLY-I", "price");

  assert.equal(plan.routeState.preferredYahooSymbol, "NLY-PI");
  assert.equal(plan.routeState.yahooSymbol, "NLY-I");
});

test("CLI keeps FX Yahoo route state free of preferred equity fallback symbols", function () {
  const ctx = loadHoodlefinance();
  const plan = ctx.hf_classifyTickerJob_("EURUSD@YAHOO", "price");

  assert.equal(plan.routeState.yahooSymbol, "EURUSD=X");
  assert.equal(plan.routeState.preferredYahooSymbol, "");
});

test("trace uses the real planned route for source-list requests", function () {
  const ctx = loadHoodlefinance();
  const trace = traceRoutingForSymbol("PH0000056814@", ctx);

  assert.equal(trace.ok, true);
  assert.equal(trace.plannedRoute, "IDENTIFIER:ISIN -> PSE-MAP -> YAHOO-ISIN");
  assert.deepEqual(trace.runtimeTrace, []);
});

test("trace uses the country-selected identifier route for non-PH ISINs", function () {
  const ctx = loadHoodlefinance();
  const trace = traceRoutingForSymbol("US02079K1079@", ctx);

  assert.equal(trace.ok, true);
  assert.equal(trace.plannedRoute, "IDENTIFIER:ISIN -> YAHOO-ISIN");
  assert.deepEqual(trace.runtimeTrace, []);
});
