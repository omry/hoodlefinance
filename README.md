# hoodlefinance

`HOODLEFINANCE` is a Google Apps Script custom function that provides a practical single-result alternative to `GOOGLEFINANCE` for many ETF-heavy and non-U.S. workflows.

It uses Yahoo Finance for quote data, direct PSE scraping for `PSE:` tickers, and source-specific ISIN resolvers for exchanges where `GOOGLEFINANCE` has no ISIN support at all.

## What It Does

- Fetches scalar quote fields such as `price`, `name`, `currency`, `tradetime`, `volume`, `high`, `low`, `open`, `close`, `changepct`, and `change`
- Supports Yahoo-style symbols such as `ISJP.L` and `ZPRX.DE`
- Supports `GOOGLEFINANCE`-style tickers such as `NASDAQ:GOOG`, `LON:SJPA`, and `ETR:ZPRX`
- Supports `PSE:` tickers directly from PSE EDGE
- Supports exchange-aware ISIN lookup with explicit and generic routing

## Quick Start

### Install in 30 Seconds

Open this raw file, copy all, and paste it into Apps Script:

```text
https://raw.githubusercontent.com/omry/hoodlefinance/master/hoodlefinance.js
```

Then test with:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```

### Manual Install

1. Open a Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Paste the contents of [`hoodlefinance.js`](https://raw.githubusercontent.com/omry/hoodlefinance/master/hoodlefinance.js) into `Code.gs`.
4. Save the project.
5. Reload the spreadsheet.

Then try:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

If you are browsing on GitHub, code blocks have GitHub's built-in copy button, and the raw file link above is the easiest way to copy the full script.

## Examples

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("PSE:BDO", "pse:isin")
=HOODLEFINANCE("GOOG", "tradingview:isin")
=HOODLEFINANCE("ISJP.L", "ibkr:isin")
```

## ISIN Support

`HOODLEFINANCE` supports both generic and explicit ISIN lookups.

- `isin`: deduce the exchange and dispatch to the configured resolver
- `tradingview:isin`: use TradingView public symbol pages
- `lon:isin`: use London Stock Exchange search results
- `pse:isin`: use PSE EDGE directly
- `ariva:isin`: use ARIVA live search and detail pages
- `ibkr:isin`: use IBKR public contract pages

Current generic `isin` routing:

- `ETR` -> `tradingview:isin`
- `LON` -> `lon:isin`
- `NASDAQ` -> `tradingview:isin`
- `NYSE` -> `tradingview:isin`
- `PSE` -> `pse:isin`

This means these work as plain `isin` lookups today:

```gs
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("5MVL.DE", "isin")
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("NYSE:IBM", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

## Local Development

Local files:

- [`hoodlefinance.js`](./hoodlefinance.js): Apps Script source
- [`hoodlefinance.test.js`](./hoodlefinance.test.js): Node test suite
- [`cli.js`](./cli.js): local CLI wrapper for smoke testing
- [`hoodlefinance-api.md`](./hoodlefinance-api.md): detailed API reference
- [`CONTRIBUTING.md`](./CONTRIBUTING.md): small developer guide for contributors

Run checks:

```sh
node --check hoodlefinance.js
node --test hoodlefinance.test.js
```

Run a quick lookup locally:

```sh
node cli.js GOOG price
node cli.js GOOG isin
node cli.js ZPRX.DE isin
node cli.js PSE:BDO isin
```

## Limits

- Only single-result quote fields are supported
- Historical data arguments are not implemented
- `marketcap` is intentionally unsupported
- Public-site resolvers can break when upstream pages change
- `ibkr:isin` can be blocked by captcha on IBKR public pages

## License

This project is MIT-licensed.

## Detailed Reference

For the full API, ticker forms, array formulas, and source-specific notes, see [`hoodlefinance-api.md`](./hoodlefinance-api.md).

## Contributing

If you want to contribute, start with [`CONTRIBUTING.md`](./CONTRIBUTING.md).
