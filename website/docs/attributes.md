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
