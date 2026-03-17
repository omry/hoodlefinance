# HOODLEFINANCE

`HOODLEFINANCE` is a Google Apps Script custom function that provides a practical alternative to `GOOGLEFINANCE` for many single-cell and array-based workflows, especially ETF-heavy and non-U.S. ones.

It uses multiple data sources to cover data, identifiers, and markets that `GOOGLEFINANCE` does not provide or does not support well.

Current script version: `0.9.2`
Current release notes: [`docs/release-notes/v0.9.2.md`](./docs/release-notes/v0.9.2.md)

Release notes: [`docs/release-notes/RELEASE_NOTES.md`](./docs/release-notes/RELEASE_NOTES.md)

There are also some limitations; see [Limits](#limits).

## Live Demo

<!-- DEMO_SHEET_LINK:START -->
See the [public demo sheet](https://docs.google.com/spreadsheets/d/1734VkJOGy621MGf431DCMPtB_Pp0235LIKMSG9YmRY4/edit?usp=sharing) for live examples. The managed tab data lives in [`docs/demo-sheet/`](./docs/demo-sheet/).
<!-- DEMO_SHEET_LINK:END -->

## Why Use It Instead Of GOOGLEFINANCE?

This is most useful if your sheet is ETF-heavy, non-U.S.-heavy, or needs identifiers that `GOOGLEFINANCE` does not expose.

- Better practical support for many foreign ETFs, especially Yahoo-style symbols such as `.L` and `.DE`
- Dedicated support for the Philippine Stock Exchange (`PSE`)
- Support for direct ISIN lookups and the `isin` output attribute
- More flexible currency conversion, including same-currency pairs such as `USDUSD` and quote-unit handling for subunit-style inputs such as `GBp` and `ILA`, where the returned rate and `currency` still reflect the requested units
- A broader practical FX surface than typical `GOOGLEFINANCE` usage, including fields such as `name`, `high`, `low`, `close`, `change`, and `changepct`
- Support for more ticker styles and exchange aliases, for example `LON:SJPA`, `ETR:ZPRX`, `NEO:ZTL`, `HKG:9988`, and `SGX:D05`

## Quick Start

1. Open a Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Copy the contents of [hoodlefinance.js (raw)](https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js) into a new script file named `HoodleFinance`.
4. Save the project and reload the spreadsheet.

Start with a simple quote:

```gs
=HOODLEFINANCE("GOOG", "price")
```

Bare tickers such as `GOOG`, `AAPL`, `MSFT`, and `IBM` are usually the most familiar place to start. If a bare ticker does not resolve the way you want, especially for international markets or ambiguous symbols, add the exchange explicitly, for example `NASDAQ:GOOG`, or use a Yahoo-style symbol such as `SJPA.L`.

Then try a few representative lookups:

```gs
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("SGX:D05", "name")
=HOODLEFINANCE("PSE:BDO", "isin")
=HOODLEFINANCE("PHY077751022", "name")
```

The script also adds a `Hoodlefinance` menu in Sheets for update-related actions.
To update the script, review the release notes, then replace the current code in Apps Script with the latest version.

## Supported Inputs

`HOODLEFINANCE` takes an identifier plus an attribute.

Supported identifiers:

Three security identifier types are supported: Google-style symbols, Yahoo-style symbols, and ISINs.

Google-style symbol examples: `NASDAQ:GOOG`, `OTCMKTS:RYCEY`, `LON:SJPA`, `ETR:ZPRX`, `HKG:9988`, `SGX:D05`, `TLV:POLI`, `EURUSD`, `CURRENCY:EURUSD`, `BTCUSD`, `DOGEUSD`, `USDUSDT`, `CURRENCY:BTC.USDT`

Yahoo-style symbol examples: `GOOG`, `ISJP.L`, `ZPRX.DE`, `9988.HK`, `D05.SI`, `POLI.TA`

ISIN examples: `US02079K1079`, `IE00B4L5YX21`, `PHY077751022`

Supported input shapes:

- Either a single identifier or an identifier range, with spilled results in the same shape

Supported attributes:

- Standard quote outputs such as `price`, `name`, `currency`, `high`, `low`, `close`, `tradetime`, `volume`, `change`, `changepct`, and `datadelay`
- Resolved identifier outputs such as `symbol[:google|:yahoo]` and `exchange[:google|:yahoo]`
- Additional outputs such as `isin`, which `GOOGLEFINANCE` does not provide directly

The resolved identifier outputs are best-effort style conversions between the supported Google-style, Yahoo-style, and ISIN forms. Use `:yahoo` or `:google` to request the output style explicitly, for example `=HOODLEFINANCE("SJPA.L", "symbol:google")` or `=HOODLEFINANCE("GOOG", "exchange:yahoo")`.

## Reference And Coverage

- Full API, ticker forms, array formulas, and source-specific notes: [`docs/hoodlefinance-api.md`](./docs/hoodlefinance-api.md)
- Sample-based exchange coverage matrix: [`support-matrix.md`](./support-matrix.md)
- Local development, tests, CLI smoke checks, demo-sheet maintenance, and support-matrix maintenance: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Need More Coverage?

If `GOOGLEFINANCE` falls short for a market, ticker format, ETF, or identifier lookup you care about, please file an issue with a concrete example for evaluation, or send a contribution following [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Limits

- Historical data arguments are not implemented
- Not all `GOOGLEFINANCE` attributes are supported
- Quote freshness depends on the upstream source and may be delayed by an unspecified amount of time
- Some lookups depend on unofficial APIs or public website behavior and may break without notice

## License

This project is MIT-licensed.
