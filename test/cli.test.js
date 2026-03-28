/* SPDX-License-Identifier: MPL-2.0 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatRoutingTable,
  formatTraceOutput,
  formatRoutingTrace,
  getRoutingTableRows,
  loadHoodlefinance,
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
        route: "PSE-TICKER -> PSE",
      },
      {
        classification: "ISIN",
        example: "US02079K1079",
        route:
          "ISIN -> PSE-MAP -> (PSE|YAHOO-ISIN -> (YAHOO|YAHOO -> TRADINGVIEW))",
      },
      {
        classification: "FORCED:YAHOO",
        example: "GOOG@YAHOO",
        route: "FORCED:YAHOO -> YAHOO",
      },
      {
        classification: "FORCED:YAHOO-ISIN",
        example: "US02079K1079@YAHOO",
        route: "FORCED:YAHOO-ISIN -> YAHOO-ISIN -> YAHOO",
      },
      {
        classification: "FORCED:GOOGLE",
        example: "EURUSD@GOOGLE",
        route: "FORCED:GOOGLE -> GOOGLE",
      },
      {
        classification: "FORCED:PSE",
        example: "PSE:BDO@PSE",
        route: "FORCED:PSE -> PSE",
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
  assert.match(output, /FORCED:PSE\tPSE:BDO@PSE\tFORCED:PSE -> PSE/);
});

test("routing trace formatter emits a readable attempted-source chain", function () {
  assert.equal(
    formatRoutingTrace({
      runtimeTrace: [
        { label: "YAHOO", status: "lookup_failure" },
        { label: "TRADINGVIEW", status: "success" },
      ],
    }),
    "YAHOO [lookup_failure] -> TRADINGVIEW [success]",
  );
  assert.equal(formatRoutingTrace({ runtimeTrace: [] }), "(no runtime trace)");
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
        routeAttempts: [{ adapterId: "yahoo-chart", traceLabel: "YAHOO" }],
        routeState: { yahooSymbol: "GOOG" },
        routeTrace: "TICKER -> YAHOO",
        source: "yahoo-chart",
      };
    },
    hf_cloneRouteAttempts_(attempts) {
      return attempts.slice();
    },
    hf_cloneRouteState_(state) {
      return Object.assign({}, state);
    },
    hf_prepareRouteJob_(job, plan) {
      job.plan = plan;
      job.routeAttempts = this.hf_cloneRouteAttempts_(plan.routeAttempts || []);
      job.routeIndex = 0;
      job.routeState = this.hf_cloneRouteState_(plan.routeState || {});
      job.routeRuntimeTrace = [];
      job.routeLastLookupFailure = "";
    },
    hf_describePlanSource_(plan) {
      return plan.routeTrace;
    },
    hf_executeRouteJobs_(jobs) {
      jobs[0].routeRuntimeTrace.push({ label: "YAHOO", status: "success" });
      jobs[0].quote = { regularMarketPrice: 1 };
    },
  };
  const output = formatTraceOutput("GOOG", fakeCtx);

  assert.match(output, /^symbol: GOOG/m);
  assert.match(output, /planned route: TICKER -> YAHOO/);
  assert.match(output, /runtime trace: YAHOO \[success\]/);
  assert.match(output, /result: success/);
});

test("CLI seeds the local PSE ISIN map for direct PSE ISIN resolution", function () {
  const ctx = loadHoodlefinance();

  assert.equal(ctx.hf_resolveIsin_("PHY1001D1010"), "PSE:AREIT");
  assert.equal(ctx.hf_resolveIsin_("PH0000056814"), "PSE:ACPAR");
  assert.equal(ctx.hf_resolveIsin_("PHY2105Y1166"), "PSE:DDPR");
});
