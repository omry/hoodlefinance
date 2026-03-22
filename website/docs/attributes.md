---
sidebar_position: 3
---

# Supported Attributes

Attribute matching is case-insensitive.

## Quote Attributes

`GOOGLEFINANCE`-like quote attributes:

- `price`
- `name`
- `currency`
- `tradetime`
- `datadelay`
- `volume`
- `high`
- `low`
- `close`
- `change`
- `changepct`

Additional `HOODLEFINANCE`-only attributes:

- `symbol[:google|:yahoo]`
- `exchange[:google|:yahoo]`
- `isin`
- `price@<currency>`

## Behavior Notes

- `price` is the default attribute.
- `close` returns the previous close price.
- `price` supports an output currency such as `price@USD`, `price@EUR`, `price@GBP`, or `price@USDT`.
- `close`, `high`, `low`, `change`, `changepct`, `currency`, `name`, `volume`, `tradetime`, `datadelay`, `symbol`, `exchange`, and `isin` do not support an output currency.
- Output-currency requests are rejected for currency-pair identifiers such as `EURUSD` or `CURRENCY:BTC.USDT`.
- `changepct` returns a fraction such as `0.0123` for `1.23%`. Format the cell as Percent in Sheets.
- `tradetime` returns a Sheets date-time value when the upstream source provides one.
- `datadelay` is source-dependent and should be treated as advisory, not a guarantee of freshness.
- `GBp` quotes are normalized to `GBP`, and `ILA` quotes are normalized to `ILS`. Money values are divided by `100` when that normalization applies.
- `symbol` defaults to Google-style output such as `LON:SJPA` or `CURRENCY:EURUSD`.
- `exchange` defaults to Google-style output such as `LON`, `NASDAQ`, `PSE`, or `CURRENCY`.
- If an upstream source does not provide a requested field, the formula returns an error for that lookup.

## The `isin` Attribute

`isin` is the generic ISIN attribute. It tries to infer the exchange from the input identifier, Yahoo suffix, or quote metadata, then dispatches to an exchange-specific resolver.

If the exchange cannot be inferred, or if no default ISIN source is configured for that exchange, the function throws a clear error and tells you to use an explicit source attribute.

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("LON:SJPA", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

That means the behavior depends partly on the input you start with:

- `=HOODLEFINANCE("LON:SJPA", "isin")` already tells the function the venue
- `=HOODLEFINANCE("SJPA.L", "isin")` lets the suffix imply the venue
- `=HOODLEFINANCE("GOOG", "isin")` relies on the resolved quote metadata
- `=HOODLEFINANCE("IE00B4L5YX21", "name")` starts from the security identifier itself, then resolves to one listing

## Explicit ISIN Sources

In normal use, `isin` should be enough. For debugging, coverage checks, and cases where you want to force a particular lookup path, use an identifier-side `@SOURCE` override.

Available source labels include:

- `@TRADINGVIEW`
- `@LON`
- `@PSE`
- `@ARIVA`
- `@IBKR`

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE@TRADINGVIEW", "isin")
=HOODLEFINANCE("LON:SJPA@LON", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
=HOODLEFINANCE("ZPRV.DE@ARIVA", "isin")
=HOODLEFINANCE("ISJP.L@IBKR", "isin")
```

Use these only when you have a specific reason to override the default behavior, such as troubleshooting a coverage gap or comparing resolver paths.

## PSE And ISIN

PSE content matters here because HoodleFinance has a dedicated PSE lookup path.

- `PSE:` tickers use the PSE EDGE route directly
- PSE ISIN lookups can also resolve through the built-in PSE ISIN map before falling back to other resolver paths

Examples:

```gs
=HOODLEFINANCE("PSE:BDO", "isin")
=HOODLEFINANCE("PSE:AP", "name")
=HOODLEFINANCE("PHY0005M1090", "symbol")
```

## Examples

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
```
