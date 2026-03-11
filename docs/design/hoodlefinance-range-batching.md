# Native Range Execution for HOODLEFINANCE

## Summary

Implement one array-aware execution path that covers the three linked TODOs together:

- native spilled-array support for `HOODLEFINANCE(tickerRange, attribute)`
- range-aware batching for quote lookups
- deduping repeated tickers within one recalculation while preserving blank cells in place

Chosen defaults:

- `ticker` may be a 2D Sheets range
- `attribute` stays scalar-only in v1
- array output preserves the exact input shape
- blank input cells return blank output cells
- array-mode failures return plain error-message strings per cell
- scalar mode keeps current behavior and still throws real errors

## Key Changes

- Update `HOODLEFINANCE` to branch into:
  - scalar path: current behavior, unchanged semantically
  - array path: normalize the ticker input into a 2D grid, validate `attribute` as scalar/`1x1`, and return a 2D result grid
- Replace the current scalar-only ticker coercion with a helper split:
  - scalar coercion for `attribute`
  - range normalization for `ticker`
  - keep `1x1` ticker ranges valid and treat them as scalar-compatible
- Introduce a per-invocation execution context object for array mode:
  - memoized result/error by `(ticker, attribute)`
  - memoized quote by normalized ticker input
  - memoized fetched text by URL for nested resolvers
  - this memo is request-local only and exists in addition to existing `CacheService` usage
- Add a quote prefetch phase for array mode:
  - collect unique non-blank ticker jobs first
  - split them into:
    - Yahoo chart requests for normal quote lookups
    - direct synthetic same-currency FX quotes
    - PSE quote jobs
    - direct-ISIN-to-Yahoo symbol resolution jobs
  - batch Yahoo chart requests with `UrlFetchApp.fetchAll`
  - batch Yahoo ISIN search requests with `UrlFetchApp.fetchAll`
  - keep PSE and scrape-based ISIN resolvers on their current logic, but dedupe them via request-local memo so repeated cells do not repeat work
- Keep attribute extraction logic source-compatible:
  - quote-based attributes (`price`, `name`, `currency`, `tradetime`, `datadelay`, `volume`, `high`, `low`, `close`, `change`, `changepct`) use the prefetched/memoized quote
  - `isin` and explicit source attributes continue through current resolvers, but repeated identical lookups reuse request-local cached values
- Preserve call-level validation:
  - unsupported historical arguments still fail the whole call
  - multi-cell `attribute` remains unsupported in v1 and throws one clear call-level error
- Update docs in `hoodlefinance-api.md` and `README.md`:
  - replace `MAP` guidance with native range examples
  - document shape preservation, blank preservation, scalar-only `attribute`, and array-mode error-string behavior

## Public API / Behavior

- `HOODLEFINANCE("NASDAQ:GOOG", "price")` remains unchanged
- `HOODLEFINANCE(A3:A, "price")` becomes supported and spills one result per input row
- `HOODLEFINANCE(A3:C10, "isin")` becomes supported and returns an output grid with the same shape
- blank ticker cells return `""`
- failed ticker cells in array mode return the plain message string that scalar mode would have thrown
- `HOODLEFINANCE(A3:A, B3:B)` remains unsupported in v1
- historical arguments remain unsupported for both scalar and array calls

## Test Plan

Add coverage for:

- scalar behavior remains unchanged for valid and invalid inputs
- `1x1` ticker range behaves the same as scalar input
- vertical ticker range spills one column with matching values
- rectangular ticker range preserves exact dimensions
- blank input cells stay blank in place
- repeated identical tickers in one array call trigger only one Yahoo chart fetch
- repeated direct-ISIN inputs trigger only one Yahoo ISIN search fetch
- repeated `isin`/`tradingview:isin` lookups reuse one underlying page fetch per unique symbol
- mixed success/failure arrays return values plus plain error strings without aborting the whole result
- unsupported multi-cell `attribute` still throws one call-level error
- unsupported historical arguments still throw one call-level error
- same-currency FX rows still short-circuit locally and do not fetch

## Assumptions

- v1 only supports ticker ranges; attribute ranges/matrices are intentionally deferred
- "Range-aware batching" means real batching for Yahoo-backed quote/search requests plus request-local dedupe for the remaining resolver paths
- No new persistent cache policy is introduced beyond current `CacheService` keys and TTLs
- Array-mode error cells are plain strings, not Sheets native error objects
