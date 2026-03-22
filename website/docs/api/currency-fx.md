---
sidebar_position: 5
sidebar_label: Currency & FX
---

# Currency & FX

`HOODLEFINANCE` supports two closely related workflows:

- looking up the price of an FX or crypto-style pair such as `EURUSD` or `CURRENCY:BTC.USDT`
- converting a security price into a requested output currency with an attribute such as `price@USD`

This page starts with the basic behavior, then goes deeper into the identifier forms, conversion rules, and practical edge cases.

## Basic Functionality

The most common currency and FX use cases are:

- getting the current price of a pair such as `EURUSD`
- requesting the current price of a security in a different output currency

Examples:

```js
=HOODLEFINANCE("EURUSD", "price")          // FX pair
=HOODLEFINANCE("CURRENCY:EURUSD", "price") // explicit form
=HOODLEFINANCE("SJPA.L", "price@USD")      // convert quote
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR") // convert quote
```

In both cases, the result is a single current numeric price.

FX pair lookups are not limited to `price`. Depending on the pair and source data, they can also return fields such as `currency`, `close`, `change`, `changepct`, and `tradetime`.

Examples:

```js
=HOODLEFINANCE("EURUSD", "currency")   // quote currency
=HOODLEFINANCE("EURUSD", "close")      // previous close
=HOODLEFINANCE("EURUSD", "changepct")  // daily change %
=HOODLEFINANCE("EURUSD", "tradetime")  // last update
```

## Output-Currency Conversion

Use `price@<currency>` when you want the quote returned in a different currency from the instrument's native quote currency.

Examples:

```js
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("IE00B4L5YX21", "price@GBP")
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR")
```

How it works:

- `HOODLEFINANCE` first resolves the identifier and retrieves the current price in its native quote currency
- it then converts that price into the requested output currency
- the result is the converted price as a single numeric value

## FX Pair Identifiers

FX and crypto-style pairs can be written in more than one supported form.

Common examples:

- `EURUSD`
- `USDJPY`
- `CURRENCY:EURUSD`
- `CURRENCY:BTC.USDT`

The shorter pair form and the `CURRENCY:` form often refer to the same lookup.

Examples:

```js
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("CURRENCY:BTC.USDT", "price")
```

Use the shorter form when it is already clear in your sheet. Use the explicit `CURRENCY:` form when you want the identifier itself to make the intent obvious.

## Supported Crypto Currencies

The current built-in crypto unit list is `ADA`, `BCH`, `BNB`, `BTC`, `DOGE`, `ETH`, `LTC`, `SOL`, `TUSD`, `USDC`, `USDT`, and `XRP`. These can be used in the same pair syntax as fiat currencies, including mixed pairs such as `BTCUSD`, `DOGEUSD`, `USDUSDT`, and explicit dotted forms such as `CURRENCY:BTC.USDT`.

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

- `price@<currency>` returns a security price in the requested output currency
- direct FX pair lookups such as `EURUSD` return the exchange rate
- output-currency conversion is rejected for currency-pair identifiers such as `EURUSD` or `CURRENCY:BTC.USDT`
- pair coverage and quote freshness still depend on upstream sources

For general attribute behavior, including the full rules for `price@<currency>`, see [Supported Attributes](attributes).
