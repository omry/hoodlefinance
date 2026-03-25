---
sidebar_position: 2
sidebar_label: Overview
slug: /api
---

# API Overview

`HOODLEFINANCE` is a Google Apps Script custom function for Google Sheets. It is built for practical current-data use cases where `GOOGLEFINANCE` is too limited, especially for non-U.S. listings, Yahoo-style symbols, direct ISIN input, and output-currency conversion.

For sampled live coverage by exchange, see the [Support Matrix](/docs/support-matrix).

## Functions

```js
/**
 * Returns a live quote, identifier, or converted price for a supported input.
 */
=HOODLEFINANCE(identifier, [attribute])
```

- `identifier`: required
- `attribute`: optional, defaults to `"price"`

## Supported Identifiers

`identifier` is the thing you want to look up. Common forms include:

- **Bare ticker**, such as `GOOG`: Best for common U.S. symbols or other identifiers that are unambiguous on their own. For non-U.S. listings, prefer an exchange-qualified, Yahoo-style, or ISIN identifier.
- **GoogleFinance-style ticker**, such as `LON:SJPA` or `FRA:ZPRX`: Use this when you want to specify the listing venue explicitly with an exchange prefix.
- **Yahoo-style symbol**, such as `SJPA.L` or `ZPRX.DE`: Use this when you want to specify the listing venue explicitly with an exchange suffix.
- **Direct ISIN**, such as `IE00B4L5YX21`: Use this when you want to start from the security itself rather than a specific exchange ticker. HoodleFinance resolves the ISIN to one supported listing before retrieving the requested value.
- **Currency pair**, such as `EURUSD` or `CURRENCY:BTC.USDT`: Use this for spot FX or crypto-style pair lookups.

For the full identifier rules, exchange-specific notes, and ISIN behavior, see [Identifiers](./api/identifiers).

# Supported Attributes

Common quote attributes include `price`, `name`, `currency`, `high`, `low`, `close`, `change`, `changepct`, `volume`, `tradetime`, and `datadelay`.

HoodleFinance also supports identifier-oriented attributes such as `symbol`, `exchange`, and `isin`, plus output-currency requests such as `price@USD`.

Support for a specific attribute can vary by exchange and by listing. Even when an exchange is generally supported, some upstream sources may not provide every field for every instrument.

For the full attribute list and behavior notes, see [Attributes](./api/attributes).


## Quick Examples

```js
=HOODLEFINANCE("NASDAQ:GOOG")              // current GOOG price
=HOODLEFINANCE("NYSE:IBM", "name")         // International Business Machines Corporation
=HOODLEFINANCE("CURRENCY:EURUSD", "price") // current EUR/USD rate
=HOODLEFINANCE("IE00B4L5YX21", "symbol")   // resolved listing symbol
=HOODLEFINANCE("SJPA.L", "price@USD")      // current SJPA price converted to USD
=HOODLEFINANCE("GOOG", "isin")             // US02079K1079
```

## Array Usage

`HOODLEFINANCE` accepts ticker ranges directly and spills results in the same shape.
This is usually the recommended way to populate many rows because it typically performs better than many separate single-cell formulas.

Example:

```js
=HOODLEFINANCE(A3:A5, "name")
```

This returns a 3-row by 1-column spill range aligned with `A3:A5`.

Whole-column example:

```js
=HOODLEFINANCE(A3:A, "price")
```

This returns a 1-column spill range. The output shape follows the filled ticker rows starting at `A3`, while blank input rows stay blank.

Range behavior:

- blank ticker cells stay blank in the spilled output
- if any populated lookup fails, Sheets surfaces a single error for the whole spill range

## Limitations

- Current-data lookups only; historical series are not implemented.
- Data freshness and field availability depend on upstream sources.
- Some lookups rely on public websites or unofficial endpoints and may change without notice.
- Support for specific capabilities can vary by exchange and by listing.
