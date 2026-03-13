# Israeli Fund / ETF Support

## Summary

Israeli ordinary equities on `TLV:` already work reasonably well through the current Yahoo-backed quote path. The gap is Israeli funds / ETFs, where current failures appear to come from two distinct problems:

- some user inputs need better TLV symbol normalization
- the current Yahoo-backed quote path does not cover all Israeli fund / ETF instruments even after normalization

This design note separates:

- simple mapping / normalization updates that can improve the Israeli market experience without changing the upstream quote source
- larger changes that require a new source for quote-backed attributes

## Current Behavior

Current TLV quote behavior is:

- `TLV:<CODE>` normalizes to `<CODE>.TA`
- quote-backed attributes such as `price` and `name` then go through the standard Yahoo chart `meta` path
- generic `isin` for `TLV` already dispatches to `tradingview:isin`

Relevant current behavior:

- `TLV:POLI` -> `POLI.TA`
- `POLI.TA` works today for quote-backed attributes
- direct Israeli stock ISIN input such as `IL0006625771` works today if Yahoo search can resolve the ISIN to a Yahoo symbol

This means the Israeli market is not one uniform problem:

- ordinary stocks are mostly covered already
- fund / ETF support is where the real gap is

## Observed Failure Cases

Manual testing so far suggests:

- `TLV:POLI`, `TLV:NICE`, and similar ordinary equities work in both `GOOGLEFINANCE` and `HOODLEFINANCE`
- `POLI.TA` is a valid `HOODLEFINANCE` win over `GOOGLEFINANCE`
- direct Israeli stock ISIN input such as `IL0006625771` is a valid `HOODLEFINANCE` win over `GOOGLEFINANCE`
- Israeli ETF / fund candidates such as `KSMF59` currently fail in `HOODLEFINANCE`

Research suggests that at least one of these failing fund symbols is malformed for current input expectations:

- public TASE / TradingView material uses dotted symbols such as `KSM.F59`
- not undotted forms such as `KSMF59`

So `TLV:KSMF59` is partly a normalization problem, not purely a missing-source problem.

## Simple Mapping / Normalization Updates

These changes do not require a new upstream quote source.

### 1. Accept dotted TLV fund symbols directly

Support explicit TLV fund / ETF tickers such as:

- `TLV:KSM.F59`
- `TASE:KSM.F59`
- `KSM.F59.TA`
- `TLV:TCH.F2`
- `TLV:MTF.F16`

Rationale:

- public Israeli fund / ETF symbols appear to use `NAME.FNN` forms
- current ticker normalization logic already preserves symbols after the exchange prefix, so this may work with minimal changes if the symbol is passed through as-is
- even if Yahoo ultimately lacks coverage, accepting the canonical ticker form is still necessary groundwork

Expected work:

- verify current parsing does not accidentally reject dotted TLV symbols
- add explicit tests for dotted `.TA` symbols under `TLV:` and native Yahoo-style input

### 2. Add optional alias normalization from undotted to dotted TLV fund forms

Support inputs like:

- `TLV:KSMF59` -> `KSM.F59.TA`

Rationale:

- users may naturally omit the dot because many finance tools do not expose it consistently
- this can convert a subset of failures into valid canonical symbols before any fetch happens

Scope guard:

- keep alias rules narrow and pattern-based
- do not add broad heuristic rewriting for arbitrary TLV tickers
- prefer exact family patterns that are observed in real TASE documents

Explicit non-goal:

- do not support bare prefixless forms such as `KSM.F59` or `KSMF59`
- require explicit exchange context through `TLV:`, `TASE:`, or Yahoo-style `.TA`

### 3. Improve direct ISIN fallback messaging for Israeli funds

Today direct ISIN input uses Yahoo search only. If Yahoo does not resolve the Israeli fund ISIN, the failure message looks like generic Yahoo search failure.

Low-cost improvement:

- detect `IL` ISINs
- if Yahoo search fails, return a more explicit error that Israeli fund / ETF ISINs may require a future TLV-specific fallback source

This is not a functional fix, but it improves user understanding immediately.

## Changes That Require A New Source

These changes cannot be solved just by ticker normalization.

### Why a new source is needed

Current quote-backed TLV attributes use Yahoo chart metadata. If Yahoo does not carry the Israeli fund / ETF instrument, then:

- `name`
- `price`
- `currency`
- `tradetime`
- `volume`
- `high`
- `low`
- `close`
- `change`
- `changepct`

cannot be recovered through the existing quote path.

This is different from current TLV `isin`, which already has a non-Yahoo path through TradingView.

### Proposed new source: TradingView public symbol pages

Best candidate source for v1:

- TradingView public symbol pages for `TASE:<CODE>`

Why this is the best fit:

- the repo already uses TradingView successfully for `tradingview:isin`
- there is already TLV / TASE mapping in place for `isin`
- public TradingView pages appear to cover Israeli funds / ETFs using canonical TASE symbols such as dotted forms
- this source is likely easier to integrate incrementally than introducing a full new TASE scraper immediately

What this source could provide in v1:

- `name`
- `price`
- maybe `currency`

What is uncertain and should not be assumed for v1:

- `volume`
- `high`
- `low`
- `close`
- `tradetime`
- `change`
- `changepct`

Those fields should only be added if TradingView exposes them reliably in page bootstrap data for Israeli funds / ETFs.

### Secondary source candidate: TASE public market pages

Alternative or future fallback:

- scrape TASE public market pages directly for fund / ETF quote data

Pros:

- exchange-native source
- may expose more official instrument metadata for Israeli funds / ETFs

Cons:

- new parser surface area
- likely more implementation work than extending existing TradingView patterns
- may require additional symbol-to-page resolution steps

Recommendation:

- do not start here unless TradingView page data proves too thin for `name` / `price`

### MAYA is out of scope for this design

`maya.tase.co.il` is intentionally excluded from the current implementation plan.

Reasoning:

- MAYA is primarily a disclosure surface, not the main current-market-data surface
- it is not a clean fit for quote-backed attributes such as live `price`
- scraping MAYA would likely require document-type-specific parsers and more symbol-to-document resolution work than TradingView
- there is no concrete Israeli-market use case in scope yet that requires MAYA specifically

If future work uncovers a narrow problem that TradingView and the existing Yahoo path cannot solve cleanly, MAYA can be reconsidered then as a separate design decision.

So the intended source ranking for this design is:

1. TradingView public `TASE:` symbol pages for public no-auth quote fallback
2. TASE official API / Data Hub only if future implementation is willing to take on auth or commercial constraints

## Recommended Implementation Plan

### Phase 1: normalization-only improvements

1. Add tests for dotted TLV fund symbols.
2. Confirm current normalization preserves canonical forms such as `TLV:KSM.F59 -> KSM.F59.TA`.
3. Add narrow alias normalization for undotted fund forms such as `TLV:KSMF59 -> KSM.F59.TA`.

Success criteria:

- canonical dotted TLV fund symbols are accepted
- common undotted user forms normalize to canonical dotted forms
- ordinary TLV equity behavior does not regress

### Phase 2: TradingView-backed TLV fund quote fallback

Add a TLV-specific fallback for quote-backed attributes when Yahoo quote lookup fails.

Suggested behavior:

1. normalize TLV ticker
2. try existing Yahoo quote path
3. if Yahoo quote lookup fails and the ticker looks like a TLV fund / ETF code, try TradingView `TASE:<CODE>`
4. extract `name` and `price` first
5. return only attributes proven to be reliable from this source

Important constraint:

- do not silently reroute all TLV equities through TradingView
- keep the new source path targeted to instruments where Yahoo coverage fails

### Phase 3: direct Israeli ISIN fallback

If direct ISIN input fails through Yahoo search:

1. detect `IL` ISIN
2. attempt to find a matching TradingView or TASE instrument
3. resolve to a canonical TLV symbol
4. then fetch through the TLV fund quote path

This phase is more complex than Phase 2 because it needs symbol discovery, not just quote retrieval.

## API / Behavior Proposal

No public function signature changes are needed.

New supported behavior should look like:

```gs
=HOODLEFINANCE("TLV:KSM.F59", "name")
=HOODLEFINANCE("TASE:KSM.F59", "name")
=HOODLEFINANCE("KSM.F59.TA", "name")
=HOODLEFINANCE("TLV:KSM.F59", "price")
=HOODLEFINANCE("TLV:KSMF59", "name")
```

Possible later extension:

```gs
=HOODLEFINANCE("IL00...", "name")
```

where the ISIN resolves through a non-Yahoo Israeli fallback if Yahoo search cannot resolve it.

## Caching

If a new TradingView-backed TLV quote path is added, cache should be explicit and separate from existing Yahoo quote cache.

Suggested cache row to add later to `docs/design/cache-matrix.md`:

- `TradingView TLV fund quotes` | parsed TradingView quote payload | `60s` to `300s`

Do not overload the existing `TradingView ISIN` cache entry because:

- quote data and ISIN data have different TTL expectations
- the artifacts are different

## Risks

- dotted TLV fund symbols may not be fully consistent across providers
- undotted-to-dotted alias mapping can become brittle if made too heuristic
- TradingView page structure may change
- quote completeness for Israeli funds / ETFs may be lower than for ordinary equities
- direct ISIN fallback for Israeli funds may require a second discovery step that is not yet designed

## Test Plan

Add coverage for:

- `TLV:POLI` still normalizes and resolves unchanged
- `POLI.TA` still works unchanged
- `TLV:KSM.F59` normalization
- `TLV:KSMF59` alias normalization, if implemented
- TLV fund fallback only activates when Yahoo quote lookup fails
- TradingView-backed TLV fund `name` and `price` extraction
- unsupported attributes fail clearly if the fallback source does not expose them
- direct Israeli stock ISIN input still works through Yahoo search
- future Israeli fund ISIN fallback only activates after Yahoo search failure

## Recommendation

The practical minimum useful scope is:

1. add canonical TLV fund ticker support
2. add narrow undotted alias normalization
3. add TradingView-backed TLV fund quote fallback for `name` and `price`

That is the smallest path that can plausibly turn current Israeli fund / ETF failures into working cases without overcommitting to a full exchange-native TASE scraping project.
