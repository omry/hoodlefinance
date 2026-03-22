---
sidebar_position: 4
---

# Identifiers

`identifier` is the first argument to `HOODLEFINANCE`. It tells the function what instrument or pair you want to resolve before retrieving an attribute such as `price`, `name`, `symbol`, or `exchange`.

The same security can often be described in more than one way. This page explains the supported forms, when each one is a good fit, and how direct ISIN input behaves in practice.

## Supported Identifier Forms

- **Bare ticker**, such as `GOOG`: Best for common U.S. symbols or other identifiers that are unambiguous on their own. For non-U.S. listings, prefer an exchange-qualified, Yahoo-style, or ISIN identifier.
- **GoogleFinance-style ticker**, such as `LON:SJPA` or `FRA:ZPRX`: Use this when you want to specify the listing venue explicitly with an exchange prefix.
- **Yahoo-style symbol**, such as `SJPA.L` or `ZPRX.DE`: Use this when you want to specify the listing venue explicitly with an exchange suffix.
- **Direct ISIN**, such as `IE00B4L5YX21`: Use this when you want to start from the security itself rather than a specific exchange ticker. HoodleFinance resolves the ISIN to one supported listing before retrieving the requested value.
- **Currency pair**, such as `EURUSD` or `CURRENCY:BTC.USDT`: Use this for spot FX or crypto-style pair lookups.

Examples:

```js
=HOODLEFINANCE("GOOG", "price")
=HOODLEFINANCE("LON:SJPA", "price")
=HOODLEFINANCE("SJPA.L", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("EURUSD", "price")
```

## Choosing An Identifier Style

In general:

- the more specific the identifier, the less guesswork is required
- non-U.S. listings are usually better expressed with a GoogleFinance-style, Yahoo-style, or ISIN input than with a bare ticker
- ISIN is useful when one security appears under multiple tickers across exchanges, even though the final quote still has to come from one supported listing
- if you want to verify what an identifier resolved to, query the identifier with attributes such as `name`, `symbol`, or `exchange`

## GoogleFinance-Style And Yahoo-Style Tickers

GoogleFinance-style and Yahoo-style identifiers are often two ways to refer to the same listing.

- `LON:SJPA` identifies the listing with an exchange prefix
- `SJPA.L` identifies that same listing with an exchange suffix

Use the style that best matches your data:

- prefer **GoogleFinance-style** symbols when you want an exchange prefix
- prefer **Yahoo-style** symbols when your source data already uses exchange suffixes such as `.L`, `.DE`, `.TA`, or `.PS`

Examples:

```js
=HOODLEFINANCE("LON:SJPA", "name") // San Juan Basin Royalty Trust
=HOODLEFINANCE("SJPA.L", "name")   // San Juan Basin Royalty Trust
```

## Direct ISIN Input

If the identifier itself is an ISIN, `HOODLEFINANCE` resolves it automatically before retrieving the requested attribute:

```js
=HOODLEFINANCE("IE00B4L5YX21", "name")         // iShares Core MSCI Japan IMI UCITS ETF USD (Acc)
=HOODLEFINANCE("ISIN:IE00B4L5YX21", "price")   // price
```

This is helpful when the same security may trade under different tickers on different exchanges, but still shares one underlying ISIN.

In HoodleFinance, direct ISIN input does not return every matching listing. Instead, the function resolves the ISIN to one supported listing and continues the lookup from there.

For the `isin` attribute itself, explicit ISIN source overrides, and exchange-specific ISIN behavior, see [Supported Attributes](attributes).
