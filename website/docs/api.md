---
sidebar_position: 2
---

# API Reference

`HOODLEFINANCE` is a Google Apps Script custom function for Google Sheets. It is built for practical current-data use cases where `GOOGLEFINANCE` is too limited, especially for non-U.S. listings, Yahoo-style symbols, direct ISIN input, and output-currency conversion.

For sampled live coverage by exchange, see the [Support Matrix](/docs/support-matrix).

## Functions

```gs
=HOODLEFINANCE(identifier, [attribute])
```

```gs
=HOODLEFINANCE_VERSION()
```

Implemented today:

- `identifier`: required
- `attribute`: optional, defaults to `"price"`

The function still accepts the broader `GOOGLEFINANCE`-style call shape for compatibility:

```gs
=HOODLEFINANCE(identifier, [attribute], [startDate], [endDateOrNumDays], [interval])
```

But the historical-style arguments are not implemented. If any of those extra arguments are supplied, the function throws an error.

`HOODLEFINANCE_VERSION()` returns the version string embedded in the script.

## Supported Attributes

Attribute matching is case-insensitive.

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

Behavior notes:

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

Examples:

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
```

## Supported Identifier Forms

`identifier` accepts:

- a stock symbol without an exchange, such as `GOOG`
- a stock symbol with an exchange, such as `NASDAQ:GOOG` or `LON:SJPA`
- a Yahoo-style symbol, such as `SJPA.L` or `ZPRX.DE`
- a direct ISIN, such as `IE00B4L5YX21` or `PHY077751022`
- a currency pair, such as `EURUSD` or `CURRENCY:BTC.USDT`

Examples:

```gs
=HOODLEFINANCE("GOOG", "price")
=HOODLEFINANCE("LON:SJPA", "price")
=HOODLEFINANCE("SJPA.L", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("EURUSD", "price")
```

### PSE Tickers

`PSE:` tickers use a dedicated PSE EDGE route rather than Yahoo:

```gs
=HOODLEFINANCE("PSE:AAA", "price")
=HOODLEFINANCE("PSE:BDO", "name")
=HOODLEFINANCE("PSE:BDO", "isin")
```

### Direct ISIN Input

If the identifier itself is an ISIN, `HOODLEFINANCE` resolves it automatically before retrieving the requested attribute:

```gs
=HOODLEFINANCE("ISIN:IE00B4L5YX21", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("PHY077751022", "name")
```

### Debug Source Suffixes

For troubleshooting and coverage checks, identifiers also support:

- `IDENTIFIER@SOURCE`: force a specific source and disable fallback
- `IDENTIFIER@?`: return the planned quote route
- `IDENTIFIER@` or `IDENTIFIER@anything-unknown`: return the supported source list

Examples:

```gs
=HOODLEFINANCE("BTCUSD@YAHOO", "price")
=HOODLEFINANCE("EURUSD@GOOGLE", "price")
=HOODLEFINANCE("BTCUSD@?")
=HOODLEFINANCE("GOOG@?")
```

## Currency Conversion

`HOODLEFINANCE` supports spot currency conversion through the same function.

For security quotes, `price` can request an output currency directly:

```gs
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("ZPRX.DE", "price@USD")
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR")
```

Accepted FX input forms include:

- bare pairs such as `EURUSD` or `USDPHP`
- prefixed pairs such as `CURRENCY:EURUSD` or `CURRENCY:ETHUSD`
- same-currency pairs such as `USDUSD`

Examples:

```gs
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("EURUSD", "name")
=HOODLEFINANCE("EURUSD", "changepct")
=HOODLEFINANCE("USDUSD", "price")
=HOODLEFINANCE("USDGBp", "currency")
```

## How `isin` Works

`isin` is the generic ISIN attribute. It tries to infer the exchange from the input identifier, Yahoo suffix, or quote metadata, then dispatches to an exchange-specific resolver.

If the exchange cannot be inferred, or if no default ISIN source is configured for that exchange, the function throws a clear error and tells you to use an explicit source attribute.

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("LON:SJPA", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

## Specific ISIN Sources

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

## Debug Route Introspection

`HOODLEFINANCE_ROUTES()` is mainly a debugging and troubleshooting aid rather than part of normal sheet usage.

```gs
=HOODLEFINANCE_ROUTES([identifier])
```

`HOODLEFINANCE_ROUTES()` returns a spilled routing table with the current quote classifications and planned routes.

`HOODLEFINANCE_ROUTES(identifier)` returns the planned quote route for one identifier, using the same static route introspection as `IDENTIFIER@?`.

## Array Usage

`HOODLEFINANCE` accepts ticker ranges directly and spills a result grid with the same shape.

Examples:

```gs
={"Price"; HOODLEFINANCE(A3:A, "price")}
```

```gs
={"Currency"; HOODLEFINANCE(A3:A, "currency")}
```

```gs
={"Name"; HOODLEFINANCE(A3:A, "name")}
```

```gs
={"ISIN"; HOODLEFINANCE(A3:A, "isin")}
```

Range behavior:

- blank ticker cells stay blank in the spilled output
- if any populated lookup fails, Sheets surfaces a single error for the whole spill range

## Limitations

- Current-data attributes only. Historical series are not implemented.
- `marketcap` is currently unsupported.
- Quote freshness depends on upstream sources and may be delayed by an unspecified amount of time.
- `isin` only works for exchanges with an implemented resolver. Quote support is broader than ISIN support.
- `isin` is not available for currency pairs.
- Some routes depend on public websites or unofficial endpoints and may break if those sites change.
- Some attributes may be unavailable for a specific listing even when the exchange is generally supported.
