# Israeli Fund / ETF Support

This note describes the current implementation for Israeli fund and ETF support in `HOODLEFINANCE`.

## Current Implementation

Israeli ordinary equities and Israeli fund / ETF symbols under `TLV:` / `TASE:` now have dedicated normalization and fallback behavior.

Implemented behavior:

- `TLV:` and `TASE:` identifiers normalize to Yahoo-style `.TA` symbols
- canonical dotted fund symbols are supported, for example `TLV:KSM.F59` -> `KSM.F59.TA`
- narrow undotted aliases are also supported, for example `TLV:KSMF59` -> `KSM.F59.TA`
- when Yahoo quote lookup fails for an Israeli fund / ETF symbol, the quote path falls back to the public TradingView `TASE:` symbol page for `name`, `price`, and `currency`
- `ILA` values are normalized to `ILS`, similar to the existing `GBp` -> `GBP` handling
- generic `isin` for `TLV` dispatches through the existing TradingView-backed ISIN path

In practice, this means symbol-based Israeli fund / ETF queries such as these are part of the current implementation:

```gs
=HOODLEFINANCE("TLV:KSM.F59", "name")
=HOODLEFINANCE("TLV:KSMF59", "price")
=HOODLEFINANCE("KSM.F59.TA", "currency")
=HOODLEFINANCE("TLV:KSMF59", "isin")
```

## Input Forms

Supported Israeli-market forms include:

- `TLV:<CODE>`
- `TASE:<CODE>`
- `<CODE>.TA`
- narrow undotted fund aliases such as `TLV:KSMF59`

Examples:

- `TLV:POLI`
- `TLV:KSM.F59`
- `TASE:KSM.F59`
- `KSM.F59.TA`
- `TLV:KSMF59`

## Current Limitations

The remaining Israeli-specific limitations are narrower than they were in the original design phase:

- bare prefixless forms such as `KSM.F59` or `KSMF59` are not supported; use `TLV:`, `TASE:`, or `.TA`
- Israeli fund / ETF support still depends partly on public TradingView symbol pages when Yahoo does not carry the quote, so it inherits the usual public-page fragility
- direct ISIN input for Israeli instruments is not implemented through a dedicated Israeli resolver; it still depends on the generic direct-ISIN path

## Notes

- This page is now a record of the implemented behavior, not the original design plan.
- For broad user-facing coverage statements, prefer the main API doc and `support-matrix.md`.
