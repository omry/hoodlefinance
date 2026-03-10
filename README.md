# HOODLEFINANCE

`HOODLEFINANCE` is a Google Apps Script custom function that provides a practical single-result alternative to `GOOGLEFINANCE` for many ETF-heavy and non-U.S. workflows.

It uses Yahoo Finance for quote data, direct PSE scraping for `PSE:` tickers, and source-specific ISIN resolvers for exchanges where `GOOGLEFINANCE` has no ISIN support at all.

## What It Does

- Fetches scalar quote fields such as `price`, `name`, `currency`, `tradetime`, `volume`, `high`, `low`, `close`, `changepct`, and `change`
- Supports Yahoo-style symbols such as `ISJP.L` and `ZPRX.DE`
- Supports `GOOGLEFINANCE`-style tickers such as `NASDAQ:GOOG`, `LON:SJPA`, and `ETR:ZPRX`
- Supports `PSE:` tickers directly from PSE EDGE
- Supports exchange-aware ISIN lookup with explicit and generic routing

## Support Matrix

<!-- SUPPORT_MATRIX:START -->
Current generated matrix:

| <span title="Code and full venue name.">Exchange</span> | <span title="Hover the info icon to see the sample tickers used for probes.">Samples</span> | <span title="Grouped attributes: price, name, currency">Basic quote<br><sub><code>price</code><br><code>name</code><br><code>currency</code></sub></span> | <span title="Grouped attributes: high, low, close">Session stats<br><sub><code>high</code><br><code>low</code><br><code>close</code></sub></span> | <span title="Grouped attributes: volume, tradetime, datadelay">Activity/time<br><sub><code>volume</code><br><code>tradetime</code><br><code>datadelay</code></sub></span> | <span title="Grouped attributes: change, changepct">Change<br><sub><code>change</code><br><code>changepct</code></sub></span> | <span title="Grouped attributes: isin">ISIN<br><sub><code>isin</code></sub></span> |
| --- | --- | --- | --- | --- | --- | --- |
| <code>NYSE</code><br><sub>New York Stock Exchange</sub> | <span title="NYSE:IBM, NYSE:KO, NYSE:DIS">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>NASDAQ</code><br><sub>Nasdaq</sub> | <span title="GOOG, AAPL, MSFT">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>LON</code><br><sub>London Stock Exchange</sub> | <span title="SJPA.L, CPXJ.L, VUAG.L">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>ETR</code><br><sub>Xetra</sub> | <span title="ZPRV.DE, ZPRX.DE, 5MVL.DE">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>TYO</code><br><sub>Tokyo Stock Exchange</sub> | <span title="7203.T, 6758.T, 9984.T">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="Failing probes: isin (7203.T, 6758.T, 9984.T).">❌</span> |
| <code>PSE</code><br><sub>Philippine Stock Exchange</sub> | <span title="PSE:BDO, PSE:AAA, PSE:JFC">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="Failing probes: high (PSE:AAA); low (PSE:AAA).">⚠️</span> | <span title="Failing probes: volume (PSE:AAA).">⚠️</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |

Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.
<!-- SUPPORT_MATRIX:END -->

This matrix is sample-based, not exhaustive. It is intended to show current practical coverage of the public interface, not a formal guarantee for every symbol on an exchange.

## Quick Start

### Install in 30 Seconds

Open this raw file, copy all, and paste it into Apps Script:

```text
https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js
```

Then test with:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```

### Manual Install

1. Open a Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Paste the contents of [`hoodlefinance.js`](https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js) into `Code.gs`.
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

## Development

For local development, tests, CLI smoke checks, and support-matrix maintenance, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

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
