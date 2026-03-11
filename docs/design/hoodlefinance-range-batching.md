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
- all inputs go through one shared batch pipeline; a scalar call is just a `1x1` batch
- any failing cell aborts the formula with one native Sheets error

## Key Changes

- Update `HOODLEFINANCE` to normalize every call into a 2D job grid:
  - scalar calls become a `1x1` grid
  - range calls preserve their original dimensions
  - successful `1x1` results unwrap back to a scalar return value; larger grids return a 2D array
  - each populated range cell behaves like an equivalent independent scalar call with the same scalar `attribute`
- Replace the current scalar-only ticker coercion with a helper split:
  - scalar coercion for `attribute`
  - range normalization for `ticker`
  - keep `1x1` ticker ranges valid and route them through the same shared execution path
- Introduce a per-invocation execution context object for array mode:
  - memoized result/error by normalized `(ticker, attribute)` input pair only
  - this memo is request-local only and exists in addition to existing `CacheService` usage
  - `CacheService` remains keyed to individual reusable upstream artifacts such as quote payloads and provider-specific resolver results, not whole array calls
- Add one reusable batch utility for all HTTP fanout:
  - one generic `fetchAll` helper handles chunking, request fanout, response collection, and stable mapping back to jobs
  - the helper chunks requests using a fixed constant `HOODLEFINANCE_FETCHALL_BATCH_SIZE_ = 50`
  - the concurrency limit is per upstream source; do not send more than `50` concurrent requests to the same source
  - introduce an explicit source concept for batching, such as Yahoo chart, Yahoo ISIN search, PSE, TradingView, LSE, ARIVA, and IBKR
  - batching utility code must not be duplicated, but source-specific fetchers are allowed
- Add source-specific fetchers on top of that shared utility:
  - collect unique non-blank `(ticker, attribute)` jobs first
  - route each job through the same provider logic it would use in scalar mode
  - Yahoo chart, Yahoo ISIN search, PSE, and scrape-based resolvers may each have their own fetcher as long as they reuse the same batch utility for HTTP fanout
  - direct synthetic same-currency FX quotes still short-circuit locally without any fetch
  - process source buckets sequentially in v1; do not add cross-source parallel fanout
- Keep attribute extraction logic source-compatible:
  - quote-based attributes (`price`, `name`, `currency`, `tradetime`, `datadelay`, `volume`, `high`, `low`, `close`, `change`, `changepct`) keep the same output and error behavior as scalar mode
  - `isin` and explicit source attributes continue through the same resolver logic they use today
- Preserve call-level validation:
  - unsupported historical arguments still fail the whole call
  - multi-cell `attribute` remains unsupported in v1 and throws one clear call-level error
  - blank or omitted scalar `attribute` still defaults to `"price"` exactly as it does today
  - if any populated cell fails, the whole formula throws one native Sheets error using the first error encountered under the source/batch processing order
- Update docs in `hoodlefinance-api.md` and `README.md`:
  - replace `MAP` guidance with native range examples
  - document shape preservation, blank preservation, scalar-only `attribute`, and whole-formula native error behavior in range mode

## Public API / Behavior

- `HOODLEFINANCE("NASDAQ:GOOG", "price")` remains unchanged
- `HOODLEFINANCE(A3:A, "price")` becomes supported and spills one result per input row
- `HOODLEFINANCE(A3:C10, "isin")` becomes supported and returns an output grid with the same shape
- blank ticker cells return `""`
- if any populated ticker cell fails, the formula aborts with one native Sheets error using one discovered failure message
- `HOODLEFINANCE(A3:A, B3:B)` remains unsupported in v1
- historical arguments remain unsupported for both scalar and array calls

## Test Plan

Add coverage for:

- scalar behavior remains unchanged for valid and invalid inputs
- `1x1` ticker range behaves the same as scalar input
- vertical ticker range spills one column with matching values
- rectangular ticker range preserves exact dimensions
- blank input cells stay blank in place
- repeated identical `(ticker, attribute)` pairs in one call execute only once and fan out their result to every matching cell
- mixed success/failure arrays abort the whole formula and surface the first encountered native error deterministically under the defined processing order
- unsupported multi-cell `attribute` still throws one call-level error
- unsupported historical arguments still throw one call-level error
- same-currency FX rows still short-circuit locally and do not fetch
- no upstream source receives more than `50` concurrent requests in one chunk

## Assumptions

- v1 only supports ticker ranges; attribute ranges/matrices are intentionally deferred
- "Range-aware batching" means one reusable `fetchAll` utility reused by source-specific fetchers, plus request-local dedupe by normalized `(ticker, attribute)` input pair
- Batch fanout uses a fixed constant of `50` requests per source-specific `fetchAll` chunk; if this ever becomes user-tunable, expose it later through a menu/settings surface rather than changing the v1 interface
- Source buckets are explicit and processed sequentially in v1; the first error encountered in that processing order is the one surfaced to Sheets
- Persistent caching stays at individual ticker/provider artifact granularity; do not add `CacheService` entries for whole array-call results
- The shared pipeline does not attempt per-cell native errors inside a spilled result; it throws one native error for the whole formula instead
