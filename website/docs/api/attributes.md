---
sidebar_position: 3
---

# Attributes

`attribute` is the second argument to `HOODLEFINANCE`. It tells the function which value to return after the identifier has been resolved, such as `price`, `name`, `currency`, `symbol`, or `isin`.

Attribute matching is case-insensitive. If you omit the second argument, `HOODLEFINANCE` defaults to `price`.

## Basic Quote Attributes

These basic quote fields provide partial parity with `GOOGLEFINANCE`:

- `price`: Current price or exchange rate.
- `name`: Display name of the resolved instrument or pair.
- `currency`: Quote currency.
- `tradetime`: Last trade or last update time when the upstream source provides one.
- `datadelay`: Advisory delay information from the upstream source.
- `volume`: Reported trading volume when the upstream source provides it.
- `high`: Session high.
- `low`: Session low.
- `close`: Previous close.
- `change`: Price change from the previous close.
- `changepct`: Percentage change from the previous close, returned as a fraction such as `0.0123` for `1.23%`.

Examples:

```js
=HOODLEFINANCE("NASDAQ:GOOG", "price")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("EURUSD", "close")
=HOODLEFINANCE("SJPA.L", "changepct")
```

## HoodleFinance-Specific Attributes

HoodleFinance adds a few attributes beyond the basic quote fields, each useful in a slightly different way:

- `isin` is useful when you need to identify the exact security, especially when it is hard to find in a broker and the ISIN is the easiest way to confirm you have the right instrument.
- `price@<currency>` simplifies price normalization for mixed-currency portfolios by turning it into a single-step lookup.
- `symbol[:google|:yahoo]` and `exchange[:google|:yahoo]` are often the most practical way to inspect, normalize, and debug how HoodleFinance resolved an identifier.

The next sections cover these in more detail, with extra focus on `price@<currency>` and `isin` because they introduce behavior beyond the basic quote fields.

Examples:

```js
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("LON:SJPA", "exchange")
```

## Price Conversion With `price@<currency>`

Use `price@<currency>` when you want a security price returned in a reporting currency rather than in the instrument's native quote currency.

This is one of the most practical HoodleFinance features because it lets a sheet compare holdings across markets without pushing conversion logic into separate helper formulas.

It is especially useful when:

- your portfolio mixes U.S., U.K., European, or Asian listings
- you want one reporting currency for summaries, dashboards, or allocation views
- you want the formula itself to return the converted price instead of maintaining a separate FX-conversion layer in the sheet

Examples:

```js
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("IE00B4L5YX21", "price@GBP")
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR")
```

Some practical rules:

- `price` is the default attribute.
- Output-currency conversion is supported only for `price`.
- `close`, `high`, `low`, `change`, `changepct`, `currency`, `name`, `volume`, `tradetime`, `datadelay`, `symbol`, `exchange`, and `isin` do not support an output-currency suffix.
- Output-currency requests are rejected for currency-pair identifiers such as `EURUSD` or `CURRENCY:BTC.USDT`.

For more on FX pairs and converted output, see [Currency & FX](currency-fx).

## Convenience Identifier Metadata

The identifier-oriented metadata attributes are useful when you want to inspect what a lookup resolved to, but they are mostly a nice-to-have rather than the main reason to use HoodleFinance:

- `symbol` defaults to Google-style output such as `LON:SJPA` or `CURRENCY:EURUSD`.
- `exchange` defaults to Google-style output such as `LON`, `NASDAQ`, `PSE`, or `CURRENCY`.
- `symbol:yahoo` and `exchange:yahoo` return Yahoo-style equivalents when that route is supported.

Examples:

```js
=HOODLEFINANCE("SJPA.L", "symbol")
=HOODLEFINANCE("LON:SJPA", "exchange")
=HOODLEFINANCE("IE00B4L5YX21", "symbol:yahoo")
```

These are most helpful for:

- debugging what a lookup resolved to
- normalizing identifier formats in a sheet
- checking whether a resolved listing matches the exchange you expected

For identifier forms and direct ISIN input, see [Identifiers](identifiers).

## The `isin` Attribute

`isin` is the generic ISIN attribute. HoodleFinance tries to infer the correct resolver path from the input identifier, Yahoo suffix, exchange prefix, or resolved quote metadata.

This is one of the key HoodleFinance capabilities because it makes security-first workflows possible. Instead of hard-coding every sheet around exchange-specific ticker formats, you can ask HoodleFinance to resolve or return the ISIN and use that as a more stable identifier across listings and data sources.

That means the behavior depends partly on the identifier you start with:

- `=HOODLEFINANCE("LON:SJPA", "isin")` already specifies the listing venue.
- `=HOODLEFINANCE("SJPA.L", "isin")` lets the Yahoo suffix imply the venue.
- `=HOODLEFINANCE("GOOG", "isin")` relies on resolved quote metadata.
- `=HOODLEFINANCE("IE00B4L5YX21", "name")` starts from the security identifier itself, then resolves to one supported listing.

If the exchange cannot be inferred, or if no default ISIN route exists for that exchange, HoodleFinance returns a clear error instead of guessing.

Examples:

```js
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("LON:SJPA", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

## FX And Data-Availability Rules

A few attributes behave differently for currency pairs or for sources that do not expose every field:

- Currency-pair identifiers reject `high`, `low`, and `volume` because the upstream FX quote pages do not expose those fields.
- `tradetime` returns a Sheets date-time value when the upstream source provides one.
- `datadelay` is source-dependent and should be treated as advisory rather than as a guarantee of freshness.
- If an upstream source does not provide a requested field, the formula returns an error for that lookup.

## Currency Normalization Notes

Money-valued attributes such as `price`, `close`, `high`, `low`, and `change` normalize `GBp` to `GBP` and `ILA` to `ILS`. When that normalization applies, numeric values are divided by `100`.

## Common Examples

```js
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```
