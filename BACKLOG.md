# Backlog

Open work imported from [`TODO.md`](./TODO.md) and inline repo TODOs.

## Performance and caching

- [ ] Investigate add-on custom-function cache misses where repeated identical `HOODLEFINANCE()` calls still take about 3 seconds on consecutive runs.
  - Source: `TODO.md`
- [ ] Pick the next concrete cache improvement from [`docs/design/performance/cache-matrix.md`](./docs/design/performance/cache-matrix.md) and implement it.
  - Source: `TODO.md`
- [ ] Implement native range execution for `HOODLEFINANCE(tickerRange, attribute)`, including range-aware batching and same-recalculation dedupe while preserving blank cells in place.
  - Source: [`docs/design/performance/hoodlefinance-range-batching.md`](./docs/design/performance/hoodlefinance-range-batching.md)

## Product and API evolution

- [ ] Evaluate the option of `symbol:ibkr`, which will resolve a stock to the IBKR symbol.
  - Source: `TODO.md`
- [ ] Support direct FX normalization syntax like `=HOODLEFINANCE("EUR", "price@USD")` so mixed portfolios with cash balances and stocks can normalize into a single target currency.
  - Motivation: useful for IBKR-style portfolios that mix currency positions and equities.
- [ ] Evaluate whether `HOODLEFINANCE()` should support multi-attribute spill output so one formula can return a compact record such as price, currency, unit, source, and instrument type together.
  - Source: `TODO.md`
- [ ] Evaluate whether this project should adopt a TypeScript-to-Apps-Script workflow for stronger typing in complex routing and request-shape code.
  - Source: `TODO.md`
- [ ] Rework source identity, grouped-source semantics, and source introspection around the gaps captured in [`docs/design/routing/routing-source-gaps.md`](./docs/design/routing/routing-source-gaps.md).
  - Source: `TODO.md`
- [ ] Implement the canonical identifier layer so preferred REIT symbols and other provider-specific identifiers render consistently across Google and Yahoo forms.
  - Source: [`docs/design/identifiers/canonical-identifier-layer.md`](./docs/design/identifiers/canonical-identifier-layer.md)
- [ ] Expose full runtime trace directly from `HOODLEFINANCE()` in Sheets, similar to the richer CLI trace output available today.
  - Sources:
    - [`hoodlefinance.js`](./hoodlefinance.js)
    - [`website/docs/api/debugging.md`](./website/docs/api/debugging.md)

## Add-on and release workflow

- [x] Implement document-level same-spreadsheet conflict detection for the tracked demo sheets so the Marketplace add-on yields to the bound-script demo install.
  - Source: `TODO.md`
- [ ] Wire the release workflow into updating the Google Sheets add-on automatically instead of treating add-on rollout as a separate manual step.
  - Source: `TODO.md`

## Maintenance tooling

- [ ] Automate the Google Apps Script refresh for the preferred REIT whitelist.
  - Source: [`tools/generate-preferred-reit-whitelist.js`](./tools/generate-preferred-reit-whitelist.js)
- [ ] Improve TS-core coverage beyond the current `check:ts:coverage` baseline, with emphasis on low-covered runtime paths rather than adding more wrapper tests.
  - Current hotspots from `/tmp/hoodlefinance-ts-coverage/lcov.info`: `quote-routing`, `ticker-normalization`, `route-execution`, `tradingview-fund`, `concrete-resolvers`, `pse-quotes`, `isin-lookup`, and `isin-sources`.
  - Focus next tests on unhappy paths, branch-heavy routing decisions, and source-specific fallback behavior.
  - Source: `npm run check:ts:coverage`

## Bug fixes and reliability

- [ ] Port the Google Finance FX fallback fix from `hoodlefinance.js` to the TypeScript source. Three changes needed: (1) `GoogleFxResolver.executeBatch` should return `lookup_failure` instead of `terminal_error` so the router falls back to the next node; (2) `hf_buildFxQuoteRouteState_` should include `yahooSymbol` from `fxPair.yahooChartSymbol`; (3) the `QUOTE:FX` plan should select both GOOGLE-FX and YAHOO-FX nodes (already wired in `spec-data.ts` as `FirstSuccessPlan`, but the old JS node selector filtered to GOOGLE only).
  - Context: Google Finance intermittently serves a `finance/beta` page with no embedded rate data, causing all FX lookups to fail until the TS fix is deployed.

## Codebase cleanup

- [ ] Make another cleanup pass and ensure there is no logic about the specifics of plans outside of the plan definition and resolvers logic, for example `HOODLEFINANCE_PLAN_ROUTE_PATH_BY_REF_`.
  - Source: `TODO.md`
