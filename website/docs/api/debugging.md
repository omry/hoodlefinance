---
sidebar_position: 6
sidebar_label: Debugging
---

# Debugging

`HOODLEFINANCE` includes a few debugging helpers for troubleshooting coverage, inspecting planned routes, and forcing a specific source when you need to compare behavior.

These features are mainly for validation and diagnosis rather than for normal sheet usage.

## Source Suffixes

Identifiers support a few debugging suffixes:

- `IDENTIFIER@SOURCE`: force a specific source and disable fallback.
- `IDENTIFIER@?`: return the planned route for that identifier.
- `IDENTIFIER@` or `IDENTIFIER@anything-unknown`: return the supported source list.

Examples:

```js
=HOODLEFINANCE("EURUSD@GOOGLE", "price") // force GOOGLE for the quote
=HOODLEFINANCE("BTCUSD@?")               // show the planned route
=HOODLEFINANCE("BTCUSD@")                // list supported sources
```

## ISIN Source Overrides

Some source labels are specifically for the `isin` attribute. These are useful when you want to compare ISIN resolver paths or check whether a particular source covers a listing.

Available `isin`-oriented labels include:

- `@TRADINGVIEW`: Use TradingView's symbol pages to resolve an ISIN. This is often the broadest fallback for non-U.S. listings.
- `@LON`: Use the London Stock Exchange route for London listings.
- `@PSE`: Use the dedicated PSE route for Philippine listings.
- `@ARIVA`: Use the ARIVA route for supported German/Xetra-style listings.
- `@IBKR`: Use Interactive Brokers contract search as the ISIN source.

These labels are only valid with the `isin` attribute.

Examples:

```js
=HOODLEFINANCE("ZPRX.DE@TRADINGVIEW", "isin")
=HOODLEFINANCE("LON:SJPA@LON", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
=HOODLEFINANCE("ZPRV.DE@ARIVA", "isin")
=HOODLEFINANCE("ISJP.L@IBKR", "isin")
```

If you try to use one of these `isin`-specific labels with a quote attribute such as `price`, HoodleFinance returns an error instead of silently treating it as a quote source.

## Route Introspection

`HOODLEFINANCE_ROUTES()` is a troubleshooting helper for inspecting planned routing behavior.

TODO: expose full runtime trace directly from `HOODLEFINANCE` in Sheets. Today the sheet-side helpers expose planned routes, while the richer runtime trace remains available through the CLI tooling.

```js
=HOODLEFINANCE_ROUTES([identifier])
```

`HOODLEFINANCE_ROUTES()` returns a spilled routing table with the current classifications and planned routes.

`HOODLEFINANCE_ROUTES(identifier)` returns the planned route for one identifier, using the same static route introspection as `IDENTIFIER@?`.

## Version Helper

`HOODLEFINANCE_VERSION()` returns the version string embedded in the installed script.

```js
=HOODLEFINANCE_VERSION()
```
