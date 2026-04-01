# Backlog

Open work imported from [`TODO.md`](./TODO.md) and inline repo TODOs.

## Performance and caching

- [ ] Investigate add-on custom-function cache misses where repeated identical `HOODLEFINANCE()` calls still take about 3 seconds on consecutive runs.
  - Source: `TODO.md`
- [ ] Pick the next concrete cache improvement from [`docs/design/cache-matrix.md`](./docs/design/cache-matrix.md) and implement it.
  - Source: `TODO.md`
- [ ] Implement native range execution for `HOODLEFINANCE(tickerRange, attribute)`, including range-aware batching and same-recalculation dedupe while preserving blank cells in place.
  - Source: [`docs/design/hoodlefinance-range-batching.md`](./docs/design/hoodlefinance-range-batching.md)

## Product and API evolution

- [ ] Evaluate the option of `symbol:ibkr`, which will resolve a stock to the IBKR symbol.
  - Source: `TODO.md`
- [ ] Evaluate whether `HOODLEFINANCE()` should support multi-attribute spill output so one formula can return a compact record such as price, currency, unit, source, and instrument type together.
  - Source: `TODO.md`
- [ ] Evaluate whether this project should adopt a TypeScript-to-Apps-Script workflow for stronger typing in complex routing and request-shape code.
  - Source: `TODO.md`
- [ ] Rework source identity, grouped-source semantics, and source introspection around the gaps captured in [`docs/design/routing-source-gaps.md`](./docs/design/routing-source-gaps.md).
  - Source: `TODO.md`
- [ ] Implement the canonical identifier layer so preferred REIT symbols and other provider-specific identifiers render consistently across Google and Yahoo forms.
  - Source: [`docs/design/canonical-identifier-layer.md`](./docs/design/canonical-identifier-layer.md)
- [ ] Expose full runtime trace directly from `HOODLEFINANCE()` in Sheets, similar to the richer CLI trace output available today.
  - Sources:
    - [`hoodlefinance.js`](./hoodlefinance.js)
    - [`website/docs/api/debugging.md`](./website/docs/api/debugging.md)

## Add-on and release workflow

- [x] Implement document-level same-spreadsheet conflict detection for the tracked demo sheets so the Marketplace add-on yields to the bound-script demo install.
  - Source: `TODO.md`
- [ ] Wire the release workflow into updating the Google Sheets add-on automatically instead of treating add-on rollout as a separate manual step.
  - Source: `TODO.md`

## Codebase cleanup

- [ ] Make another cleanup pass and ensure there is no logic about the specifics of plans outside of the plan definition and resolvers logic, for example `HOODLEFINANCE_PLAN_ROUTE_PATH_BY_REF_`.
  - Source: `TODO.md`
