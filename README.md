# HOODLEFINANCE

`HOODLEFINANCE` is a Google Apps Script custom function that provides a practical alternative to `GOOGLEFINANCE` for many single-cell and array-based workflows, especially ETF-heavy and non-U.S. ones.

It uses Yahoo Finance for quote data and adds ISIN support that `GOOGLEFINANCE` does not provide.

Current script version: `0.2.0`

Quote freshness depends on the upstream source used for a given symbol and attribute. In practice, price data may be delayed by an unspecified amount of time, and the delay is not guaranteed to be consistent across exchanges or resolvers.

There are also some limitations; see [Limits](#limits).

## What It Does

- Fetches scalar quote fields such as `price`, `name`, `currency`, `tradetime`, `volume`, `high`, `low`, `close`, `changepct`, and `change`
- Accepts either a single ticker or a ticker range and spills results with the same shape
- Supports Yahoo-style symbols such as `ISJP.L`, `ZPRX.DE`, `9988.HK`, `D05.SI`, and `POLI.TA`
- Supports `GOOGLEFINANCE`-style tickers such as `NASDAQ:GOOG`, `OTCMKTS:RYCEY`, `LON:SJPA`, `ETR:ZPRX`, `HKG:9988`, `SGX:D05`, and `TLV:POLI`

## Why Use It Instead Of GOOGLEFINANCE?

The short version: this is most useful if your sheet is ETF-heavy, non-U.S.-heavy, or needs identifiers that `GOOGLEFINANCE` does not expose.

- Better practical support for many foreign ETFs, especially Yahoo-style symbols such as `.L` and `.DE`
- Dedicated support for the Philippine Stock Exchange (`PSE`)
- Support for `isin` lookups
- Support for more ticker styles and exchange aliases, for example `LON:SJPA`, `ETR:ZPRX`, `HKG:9988`, and `SGX:D05`

If you only need basic U.S. large-cap quotes and do not care about ISINs, `GOOGLEFINANCE` may already be sufficient. This is not a full drop-in replacement because historical arguments are still unsupported. The main value here is better behavior for cross-market portfolios and more predictable spreadsheet formulas around them.

If `GOOGLEFINANCE` falls short for a market, ticker format, ETF, or identifier lookup you care about, please file an issue with a concrete example for evaluation, or send a contribution following [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Support Matrix

See [`support-matrix.md`](./support-matrix.md) for the full sample-based exchange coverage matrix.

## Live Demo

<!-- DEMO_SHEET_LINK:START -->
See the [public demo sheet](https://docs.google.com/spreadsheets/d/1734VkJOGy621MGf431DCMPtB_Pp0235LIKMSG9YmRY4/edit?usp=sharing) for live examples. The managed tab data lives in [`docs/demo-sheet/`](./docs/demo-sheet/).
<!-- DEMO_SHEET_LINK:END -->

## Quick Start

1. Open a Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Open the raw source file: [hoodlefinance.js (raw)](https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js)
4. Copy the file contents into `Code.gs`.
5. Save the project and reload the spreadsheet.

Start with:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```
Then try a few more examples:

```gs
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
=HOODLEFINANCE("9988.HK", "isin")
=HOODLEFINANCE("SGX:D05", "isin")
=HOODLEFINANCE("POLI.TA", "isin")
=HOODLEFINANCE("OTCMKTS:RYCEY", "isin")
```

To confirm which pasted version is in your sheet:

```gs
=HOODLEFINANCE_VERSION()
```

The bound script also adds a `Hoodlefinance` menu in Sheets with:

- `Check for updates`
- `Show installed version`
- automatic once-per-day version checks on open
- per-user suppression for automatic update checks

## Examples

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("CURRENCY:USDUSD", "price")
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("9988.HK", "isin")
=HOODLEFINANCE("SGX:D05", "isin")
=HOODLEFINANCE("POLI.TA", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
=HOODLEFINANCE("OTCMKTS:RYCEY", "isin")
```

## ISIN Support

`HOODLEFINANCE` supports both generic and explicit ISIN lookups.

- `isin`: deduce the exchange and dispatch to the configured resolver
- exchange-specific source attributes are also available for debugging or forced-source lookups

Current generic `isin` routing:

- `ETR` -> `tradingview:isin`
- `HKG` -> `tradingview:isin`
- `LON` -> `lon:isin`
- `NASDAQ` -> `tradingview:isin`
- `NYSE` -> `tradingview:isin`
- `OTCMKTS` -> `tradingview:isin`
- `PSE` -> `pse:isin`
- `SGX` -> `tradingview:isin`
- `TLV` -> `tradingview:isin`

This means these work as plain `isin` lookups today:

```gs
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("5MVL.DE", "isin")
=HOODLEFINANCE("SJPA.L", "isin")
=HOODLEFINANCE("9988.HK", "isin")
=HOODLEFINANCE("SGX:D05", "isin")
=HOODLEFINANCE("POLI.TA", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("NYSE:IBM", "isin")
=HOODLEFINANCE("OTCMKTS:RYCEY", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

For the explicit source-backed ISIN attributes, see [`hoodlefinance-api.md`](./hoodlefinance-api.md).

## Development

For local development, tests, CLI smoke checks, demo-sheet maintenance, and support-matrix maintenance, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Limits

- Historical data arguments are not implemented
- Not all `GOOGLEFINANCE` attributes are supported
- Quote freshness depends on the upstream source and may be delayed by an unspecified amount of time
- Some lookups depend on unofficial APIs or public website behavior and may break without notice

## License

This project is MIT-licensed.

## Detailed Reference

For the full API, ticker forms, array formulas, and source-specific notes, see [`hoodlefinance-api.md`](./hoodlefinance-api.md).

## Contributing

If you want to contribute, start with [`CONTRIBUTING.md`](./CONTRIBUTING.md).
