---
sidebar_position: 5
sidebar_label: Currency & FX
---

# Currency & FX

`HOODLEFINANCE` supports two closely related workflows:

- looking up the price of an FX or crypto-style pair such as `EURUSD` or `CURRENCY:BTC.USDT`
- converting a security price into a requested output currency with an attribute such as `price@USD`

## FX Pair Lookups

FX pair lookups support fields such as `price`, `currency`, `name`, `symbol`, `exchange`, `close`, `change`, `changepct`, `tradetime`, and `datadelay`.

A few examples:

```js
=HOODLEFINANCE("EURUSD", "price")      // exchange rate
=HOODLEFINANCE("EURUSD", "currency")   // quote currency
=HOODLEFINANCE("EURUSD", "close")      // previous close
=HOODLEFINANCE("EURUSD", "changepct")  // daily change %
=HOODLEFINANCE("EURUSD", "tradetime")  // last update
```

## Security Price Conversion

Use `price@<currency>` when you want the quote returned in a different currency from the instrument's native quote currency.

Examples:

```js
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("IE00B4L5YX21", "price@GBP")
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR")
```

## FX Pair Identifiers

FX and crypto-style pairs can be written in more than one supported form.

For example, the same pair can be written as:

- `USDPHP`
- `CURRENCY:USDPHP`
- `CURRENCY:USD.PHP`

Use the shorter form when it is already clear in your sheet. Use the explicit `CURRENCY:` form when:

- you want the identifier itself to make the intent obvious
- a 4-character leg needs dotted notation such as `CURRENCY:BTC.USDT`
- a compact form would otherwise be ambiguous

When a compact form is ambiguous, you must write it explicitly. For example, `CURRENCY:USDTUSD` cannot be used because it could mean either `USD.TUSD` or `USDT.USD`.

Examples:

```js
=HOODLEFINANCE("CURRENCY:USD.TUSD", "price")
=HOODLEFINANCE("CURRENCY:USDT.USD", "price")
```

## Supported Crypto Currencies

The current built-in crypto unit list is `ADA`, `BCH`, `BNB`, `BTC`, `DOGE`, `ETH`, `LTC`, `SOL`, `TUSD`, `USDC`, `USDT`, and `XRP`. These can be used in the same pair syntax as fiat currencies, including mixed pairs such as `BTCUSD`, `DOGEUSD`, and `USDUSDT`. The explicit dotted form is also available for 4-character legs, for example `CURRENCY:BTC.USDT`.

## Same-Currency Pairs

Pairs such as `USDUSD` are supported and resolve to `1`. The same pattern also extends to subunit currencies such as `GBPGBp` and `GBpGBP`.

Example:

```js
=HOODLEFINANCE("USDUSD", "price") // 1
=HOODLEFINANCE("GBPGBp", "price") // 100
=HOODLEFINANCE("GBpGBP", "price") // 0.01
```

This is useful when:

- your sheet builds pair identifiers dynamically
- you want conversion logic that does not need a special-case branch for identical currencies

## Conversion And Pair Rules

Some practical rules are worth keeping in mind:

- output-currency conversion is rejected for currency-pair identifiers such as `EURUSD` or `CURRENCY:BTC.USDT`
- currency-pair identifiers reject `high`, `low`, and `volume` because the upstream FX quote pages do not expose those fields
- pair coverage and quote freshness still depend on upstream sources

For general attribute behavior, including the full rules for `price@<currency>`, see [Supported Attributes](attributes).
