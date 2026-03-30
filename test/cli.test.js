/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatRoutingTable,
  formatTraceResultSummary,
  formatTraceOutput,
  formatRoutingTrace,
  getRoutingTableRows,
  loadHoodlefinance,
  traceRoutingForSymbol,
} = require("../tools/_shared/cli.js");

test("routing table rows cover the current quote classifications", function () {
  assert.equal(
    JSON.stringify(getRoutingTableRows()),
    JSON.stringify([
      { classification: "TICKER", example: "GOOG", route: "TICKER -> YAHOO" },
      {
        classification: "TICKER-IL-FUND",
        example: "TLV:KSMF59",
        route: "TICKER-IL-FUND -> YAHOO -> TRADINGVIEW",
      },
      { classification: "FX", example: "EURUSD", route: "FX -> GOOGLE" },
      {
        classification: "FX-SAME",
        example: "USDUSD",
        route: "FX-SAME -> LOCAL",
      },
      {
        classification: "PSE-TICKER",
        example: "PSE:BDO",
        route: "PSE-TICKER -> PSE-FRAMES -> PSE-EDGE",
      },
      {
        classification: "ISIN",
        example: "US02079K1079",
        route: "IDENTIFIER:ISIN -> PSE-MAP -> YAHOO-ISIN",
      },
      {
        classification: "FORCED:YAHOO",
        example: "GOOG@YAHOO",
        route: "YAHOO",
      },
      {
        classification: "FORCED:YAHOO-ISIN",
        example: "US02079K1079@YAHOO",
        route: "IDENTIFIER:YAHOO-ISIN -> YAHOO-ISIN => YAHOO",
      },
      {
        classification: "FORCED:GOOGLE",
        example: "EURUSD@GOOGLE",
        route: "GOOGLE",
      },
      {
        classification: "FORCED:PSE",
        example: "PSE:BDO@PSE",
        route: "PSE-FRAMES -> PSE-EDGE",
      },
      {
        classification: "FORCED:PSE-FRAMES",
        example: "PSE:BDO@PSE-FRAMES",
        route: "PSE-FRAMES",
      },
      {
        classification: "FORCED:PSE-EDGE",
        example: "PSE:BDO@PSE-EDGE",
        route: "PSE-EDGE",
      },
    ]),
  );
});

test("routing table formatter emits a readable header and rows", function () {
  const output = formatRoutingTable(getRoutingTableRows());

  assert.match(output, /^classification\texample\tplanned route/m);
  assert.match(output, /TICKER\tGOOG\tTICKER -> YAHOO/);
  assert.match(
    output,
    /TICKER-IL-FUND\tTLV:KSMF59\tTICKER-IL-FUND -> YAHOO -> TRADINGVIEW/,
  );
  assert.match(
    output,
    /FORCED:PSE\tPSE:BDO@PSE\tPSE-FRAMES -> PSE-EDGE/,
  );
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
  const output = formatTraceOutput("GOOG", fakeCtx);

  assert.match(output, /^symbol: GOOG/m);
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

test("trace uses the real planned route for source-list requests", function () {
  const ctx = loadHoodlefinance();
  const trace = traceRoutingForSymbol("PH0000056814@", ctx);

  assert.equal(trace.ok, true);
  assert.equal(trace.plannedRoute, "IDENTIFIER:ISIN -> PSE-MAP -> YAHOO-ISIN");
  assert.deepEqual(trace.runtimeTrace, []);
});
