> Historical note: this document describes an earlier routing/fallback design and is kept for context only. It does not describe the current `DagPlan`-driven TS runtime architecture.

# Explicit Routing And Fallback Framework

## Summary

Replace the current `plan.source` plus scattered fallback branches with an explicit routing framework.

The new design has two layers:

- a routing layer that builds an ordered route graph for each request
- a standardized upstream-adapter layer that executes one route step at a time

This should make source selection, fallback behavior, and `@?` introspection come from the same model instead of being split across classification, batch prefetch, and scalar fetch helpers.

## Goals

- Make quote and `isin` routing explicit and centralized.
- Standardize how upstream sources are invoked and how they report success or failure.
- Ensure fallback behavior is driven by policy, not ad-hoc exception handling.
- Make `IDENTIFIER@?` reflect the planned route graph.
- Keep the design compatible with future live tracing such as `@TRACE`.

## Non-Goals

- Do not add new user-facing source-selection syntax in this pass.
- Do not invent new fallback chains for `isin` lookups beyond current behavior.
- Do not make `@?` perform live network work in this pass.
- Do not redesign quote extraction or exchange-specific parsing logic beyond interface normalization.

## Current Problems

Today the code has a central classification step, but real fallback behavior still happens later in source-specific code:

- Yahoo chart can fall back to TradingView for Israeli funds.
- Yahoo ISIN resolution can pivot into PSE via the local PSE ISIN map.
- Scalar `hoodlefinanceFetchQuote_` contains its own fallback logic separate from batch prefetch.
- `@?` reports only the initial deduced source, not the actual route shape.

This creates several issues:

- routing behavior is hard to reason about
- scalar and batch behavior can drift
- user-facing errors leak implementation details
- `@?` is only partially truthful

## Proposed Model

### 1. Route families

Introduce explicit route families:

- `quote`
- `isin`

A route is an ordered list of route attempts.

Each attempt has:

- `adapterId`
- `traceLabel`
- `capability`
- `fallbackAllowed`
- optional `pivotOnSuccess`
- optional `nextOnLookupFailure`

### 2. Adapter contract

Every upstream source should implement the same interface.

Each adapter definition exposes:

- `adapterId`
- `traceLabel`
- `capability`
- `batchKey(job)`
- `executeBatch(jobs)`

Each per-job result must be one of:

- `success`
- `lookup_failure`
- `terminal_error`
- `pivot`

Result meanings:

- `success`: the requested data is resolved
- `lookup_failure`: this source did not resolve the request, and fallback may continue
- `terminal_error`: stop immediately and surface the error
- `pivot`: continue with a new explicit route fragment using resolved intermediate data

Adapters should not mutate routing plans directly and should not use thrown exceptions as normal fallback control flow.

## Standardized Payloads

### Quote success payload

Quote adapters return a normalized quote object in the existing common quote shape used by extraction.

### Symbol-resolve success payload

Resolvers such as Yahoo ISIN search return a normalized identifier record, for example:

- resolved ticker/symbol
- any normalized source-specific symbol form
- any routing metadata needed by the next route

### ISIN success payload

ISIN adapters return:

- `isin`

## Route Definitions

### Quote routes

#### Direct PSE ticker

Route:

- `PSE`

#### Same-currency FX pair

Route:

- `LOCAL`

#### Non-same FX pair

Route:

- `GOOGLE`

#### Plain ticker

Route:

- `YAHOO -> TRADINGVIEW`

Notes:

- TradingView fallback remains limited to the current Israeli-fund Yahoo failure case.
- This should be encoded as explicit route policy, not late special-case branching.

#### Direct ISIN input used as quote identifier

Route:

- local PSE-map resolve when deterministic
- otherwise `ISIN:YAHOO`
- on success, pivot into either:
  - `PSE`
  - `YAHOO -> TRADINGVIEW`

### Forced-source quote routes

#### `@YAHOO`

- Yahoo chart only
- no fallback

#### `@GOOGLE`

- Google FX only
- only valid for FX pairs
- no fallback

#### `@PSE`

- direct PSE ticker or PSE-mapped ISIN only
- no fallback

### ISIN attribute routes

For `attribute = "isin"`:

- direct ISIN input short-circuits locally
- FX context rejects immediately
- otherwise use exchange/source-deduced explicit single-source routes:
  - `ARIVA`
  - `IBKR`
  - `LON`
  - `PSE`
  - `TRADINGVIEW`

This pass should not add cross-source `isin` fallback beyond what already exists.

## Failure Policy

Fallback is allowed only for `lookup_failure`.

Examples of `lookup_failure`:

- no quote found
- no symbol match
- source unavailable
- upstream 5xx / temporary blocking
- existing Israeli fund Yahoo no-data case

Examples of `terminal_error`:

- unsupported source override
- invalid ticker shape
- unsupported attribute for the resolved object
- missing field on a resolved quote
- `isin` requested for an FX pair

This keeps fallback focused on "try the next source" cases, not "paper over semantic mismatches" cases.

## Execution Model

Introduce a shared route executor used by both array/batch and scalar paths.

Executor flow:

1. Build a route state for each job.
2. Group unresolved jobs by current adapter and batch key.
3. Execute each adapter batch once.
4. For each job:
   - store runtime trace entry
   - complete `success`
   - advance on `lookup_failure`
   - pivot on `pivot`
   - stop on `terminal_error`
5. Repeat until all jobs are resolved or exhausted.

This executor should be used by:

- batch prefetch path
- scalar `hoodlefinanceFetchQuote_`

That removes the current duplication between batch and scalar fallback logic.

## `@?` Introspection

`IDENTIFIER@?` should become static route introspection.

Behavior:

- build the quote route graph
- render the public route labels
- do not perform network work

Examples:

- `USDUSD@?` -> `LOCAL`
- `EURUSD@?` -> `GOOGLE`
- `PSE:AAA@?` -> `PSE`
- regular Yahoo-routed ticker -> `YAHOO -> TRADINGVIEW`

Where a later route depends on resolved intermediate data, grouped output is acceptable, for example:

- `ISIN:YAHOO -> (PSE|YAHOO -> TRADINGVIEW)`

`@?` must not expose internal function names or implementation-specific resolver ids.

## Runtime Trace

Even though `@?` is static in this pass, each executed job should retain an internal runtime trace such as:

- attempted adapter labels
- result kind per attempt
- final winner or terminal failure

This is for future debugging and potential live-trace surfaces such as `@TRACE`.

## Expected Refactor Boundaries

The following logic should become pure adapters or adapter helpers:

- Yahoo chart quote fetch
- Google Finance™ FX fetch
- PSE quote fetch
- Yahoo ISIN search
- TradingView Israeli fund quote fetch
- exchange-specific `isin` resolvers

The following logic should move out of source helpers and into the routing layer:

- fallback decisions
- pivot decisions
- scalar vs batch routing differences
- `@?` source description logic

## Testing

Add tests for:

- static `@?` output for each major route shape
- scalar and batch consistency for fallback behavior
- Yahoo quote lookup failure falling through to TradingView
- direct PSE-mapped ISIN bypassing Yahoo ISIN search
- direct ISIN resolution pivoting into the correct quote route
- forced source overrides disabling fallback
- `lookup_failure` falling through but `terminal_error` not falling through
- adapter contract normalization
- runtime trace recording order and final outcome

## Assumptions

- `@?` is static in this pass.
- A future live interface such as `@TRACE` may be added later.
- Forced source overrides keep their current meaning: they disable fallback.
- Public route labels may use stable stage names such as `ISIN:YAHOO`, but not internal resolver names.
- This design covers quote routing and `isin` routing first; error-message cleanup can follow once the framework exists.
