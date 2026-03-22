---
sidebar_position: 2
sidebar_label: API Overview
---

# API Overview

`HOODLEFINANCE` is a Google Apps Script custom function for Google Sheets. It is built for practical current-data use cases where `GOOGLEFINANCE` is too limited, especially for non-U.S. listings, Yahoo-style symbols, direct ISIN input, and output-currency conversion.

For sampled live coverage by exchange, see the [Support Matrix](support-matrix).

## Functions

```js
/**
 * Returns a live quote, identifier, or converted price for a supported input.
 */
=HOODLEFINANCE(identifier, [attribute])
```

## Supported Identifiers

`identifier` is the thing you want to look up. Common forms include:

- **Bare ticker**, such as `GOOG`: Best for common U.S. symbols or other identifiers that are unambiguous on their own. For non-U.S. listings, prefer an exchange-qualified, Yahoo-style, or ISIN identifier.
- **GoogleFinance-style ticker**, such as `LON:SJPA` or `FRA:ZPRX`: Use this when you want to specify the listing venue explicitly with an exchange prefix.
- **Yahoo-style symbol**, such as `SJPA.L` or `ZPRX.DE`: Use this when you want to specify the listing venue explicitly with an exchange suffix.
- **Direct ISIN**, such as `IE00B4L5YX21`: Use this when you want to start from the security itself rather than a specific exchange ticker. HoodleFinance resolves the ISIN to one supported listing before retrieving the requested value.
- **Currency pair**, such as `EURUSD` or `CURRENCY:BTC.USDT`: Use this for spot FX or crypto-style pair lookups.

For the full identifier rules, exchange-specific notes, and ISIN behavior, see [Identifiers](identifiers).

# Supported attrbutes
TODO

```js
/**
 * Returns the currently installed HoodleFinance version string.
 */
=HOODLEFINANCE_VERSION()
```

- `identifier`: required
- `attribute`: optional, defaults to `"price"`

The function still accepts the broader `GOOGLEFINANCE`-style call shape for compatibility:

```gs
=HOODLEFINANCE(identifier, [attribute], [startDate], [endDateOrNumDays], [interval])
```

But the historical-style arguments are not implemented. If any of those extra arguments are supplied, the function throws an error.

`HOODLEFINANCE_VERSION()` returns the version string embedded in the script.


## Quick Examples

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("GOOG", "isin")
```

## What It Covers

- current quote attributes such as `price`, `name`, `high`, `low`, `volume`, and `change`
- identifier normalization across GoogleFinance-style symbols, Yahoo-style symbols, direct ISIN input, and currency pairs
- output-currency conversion through `price@<currency>`
- array formulas over ticker ranges
- route introspection and source forcing for troubleshooting

## Main Limits

- current-data attributes only; historical series are not implemented
- `marketcap` is currently unsupported
- quote freshness depends on upstream sources and may be delayed
- some routes depend on public websites or unofficial endpoints and may break if those sites change
- some attributes may be unavailable for a specific listing even when the exchange is generally supported
