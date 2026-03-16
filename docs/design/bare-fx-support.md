# Bare FX Support

This note describes the planned support for bare FX identifiers such as `USDPHP`, alongside the existing `CURRENCY:USDPHP` form.

The goal is to treat FX parsing as a generic currency-unit facility:

- bare FX detection is strict
- canonical currencies come from a bundled ISO 4217 alphabetic-code set
- non-ISO upstream currency-unit aliases are supported through an explicit alias table
- FX output values and `currency` reflect the requested input/output units, including unit scaling when aliases represent subunits

## Goal

The user-facing goal is to:

- support bare FX pairs such as `USDPHP`
- keep `CURRENCY:` support unchanged
- preserve compatibility with the current richer FX attribute behavior in `HOODLEFINANCE`

This change is about input parsing and currency-unit semantics. It is not meant to narrow existing FX attribute support down to `GOOGLEFINANCE`.

## Detection Rules

The parser should:

- accept `CURRENCY:<pair>` and bare compact `<pair>` forms such as `EURUSD` or `DOGEUSD`
- split compact pairs into recognized 3- or 4-character legs
- accept dotted prefixed pairs such as `CURRENCY:BTC.USDT` when explicit disambiguation is needed
- treat a bare token as FX only if exactly one valid split exists
- otherwise leave the token on the normal ticker path

Out of scope: 2-letter codes, slash/dash separators, and bare dotted syntax such as `DOGE.USD`.
Supported forms remain bare compact `<pair>`, compact `CURRENCY:<pair>`, and dotted `CURRENCY:<base>.<quote>`.

## Currency Code Model

The code model should have two layers:

- a static ISO 4217 alphabetic-code set for canonical currencies
- a repo-owned alias map for non-ISO upstream quote units

The canonical code set is the source of truth for FX lookup. Aliases normalize to their canonical currency for upstream requests, but the originally requested units are preserved for output scaling and the `currency` attribute.

The alias map is intentionally explicit rather than heuristic. It should start with currently observed upstream units and can grow as new real cases are found.

## Scaling Semantics

Yahoo FX lookup should be built only from canonical currencies.

For example:

- `USDPHP` -> `USDPHP=X`
- `GBpUSD` -> `GBPUSD=X`
- `DOGEUSD` -> `DOGEUSD=X`
- `USDUSDT` -> `USDUSDT=X`
- `USDILA` -> `USDILS=X`

The returned numeric values should then be scaled to match the requested input/output units.

Planned behavior:

- scale `price`, `close`, `high`, `low`, and `change`
- do not scale `changepct`
- return the requested quote unit from `currency`
- ensure same-currency shortcuts respect unit differences, not just canonical currency equality

This means same-canonical-currency pairs with different units must still scale correctly. For example, a pair equivalent to `GBP -> GBp` should return a `100x` ratio, while `GBp -> GBP` should return a `0.01x` ratio.

## Compatibility Notes

This design keeps the current richer FX attribute behavior in `HOODLEFINANCE`.

It does not:

- add special `N/A` handling just to mimic `GOOGLEFINANCE`
- change non-FX currency normalization semantics for securities
- broaden bare FX detection to any arbitrary 6- to 8-letter token

The intent is to add bare FX support and generic unit normalization without regressing existing stock, ISIN, PSE, Israeli-market, or prefixed-FX behavior.

## Validation Plan

Implementation should be validated with both unit tests and live CLI smoke checks.

Unit tests should cover:

- normalization of bare and prefixed FX pairs through the same canonical Yahoo symbol
- strict detection so only recognized currency/unit pairs are treated as bare FX
- same-currency and mixed-unit shortcuts
- scaling of `price`, `close`, `high`, `low`, `change`, and non-scaling of `changepct`
- regressions for non-FX ticker handling and existing quote-money normalization

Live smoke checks should cover:

- bare canonical FX pairs such as `USDPHP`
- same-currency bare FX pairs such as `USDUSD`
- prefixed and bare alias-unit examples once supported

## Assumptions

- The filename for this note is `docs/design/bare-fx-support.md`.
- This is a design / implementation note, not a user-facing API reference.
- Supported canonical currencies come from a bundled ISO 4217 alphabetic-code list.
- Supported non-ISO units come from an explicit repo-owned alias table.
- The alias set starts with observed upstream non-ISO quote units and can grow as new real cases are found.
