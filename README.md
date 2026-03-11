# HOODLEFINANCE

`HOODLEFINANCE` is a Google Apps Script custom function that provides a practical single-result alternative to `GOOGLEFINANCE` for many ETF-heavy and non-U.S. workflows.

It uses Yahoo Finance for quote data and adds ISIN support that `GOOGLEFINANCE` does not provide.

Current script version: `0.1.1`

Quote freshness depends on the upstream source used for a given symbol and attribute. In practice, price data may be delayed by an unspecified amount of time, and the delay is not guaranteed to be consistent across exchanges or resolvers.

## What It Does

- Fetches scalar quote fields such as `price`, `name`, `currency`, `tradetime`, `volume`, `high`, `low`, `close`, `changepct`, and `change`
- Supports Yahoo-style symbols such as `ISJP.L`, `ZPRX.DE`, `9988.HK`, `D05.SI`, and `POLI.TA`
- Supports `GOOGLEFINANCE`-style tickers such as `NASDAQ:GOOG`, `OTCMKTS:RYCEY`, `LON:SJPA`, `ETR:ZPRX`, `HKG:9988`, `SGX:D05`, and `TLV:POLI`

## Support Matrix

<!-- SUPPORT_MATRIX:START -->
| <span title="Code and full venue name.">Exchange</span> | <span title="Hover the info icon to see the sample tickers used for probes.">Samples</span> | <span title="Grouped attributes: price, name, currency">Basic quote<br><sub><code>price</code><br><code>name</code><br><code>currency</code></sub></span> | <span title="Grouped attributes: high, low, close">Session stats<br><sub><code>high</code><br><code>low</code><br><code>close</code></sub></span> | <span title="Grouped attributes: volume, tradetime, datadelay">Activity/time<br><sub><code>volume</code><br><code>tradetime</code><br><code>datadelay</code></sub></span> | <span title="Grouped attributes: change, changepct">Change<br><sub><code>change</code><br><code>changepct</code></sub></span> | <span title="Grouped attributes: isin">ISIN<br><sub><code>isin</code></sub></span> |
| --- | --- | --- | --- | --- | --- | --- |
| <code>HKG</code><br><sub>Hong Kong Stock Exchange</sub> | <span title="9988.HK (Alibaba / BABA), 1299.HK, 1810.HK">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>LON</code><br><sub>London Stock Exchange</sub> | <span title="SJPA.L, CPXJ.L, VUAG.L">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>NASDAQ</code><br><sub>Nasdaq</sub> | <span title="GOOG, AAPL, MSFT">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>NYSE</code><br><sub>New York Stock Exchange</sub> | <span title="NYSE:IBM, NYSE:KO, NYSE:DIS">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>OTCMKTS</code><br><sub>OTC Markets</sub> | <span title="OTCMKTS:RYCEY, OTCMKTS:NSRGY, OTCMKTS:TCEHY">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>PSE</code><br><sub>Philippine Stock Exchange</sub> | <span title="PSE:BDO, PSE:AAA, PSE:JFC">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="Failing probes: high (PSE:AAA); low (PSE:AAA).">⚠️</span> | <span title="Failing probes: volume (PSE:AAA).">⚠️</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>SGX</code><br><sub>Singapore Exchange</sub> | <span title="SGX:D05, SGX:U11, SGX:O39">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>TLV</code><br><sub>Tel Aviv Stock Exchange</sub> | <span title="TASE.TA, POLI.TA, NICE.TA">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |
| <code>TYO</code><br><sub>Tokyo Stock Exchange</sub> | <span title="7203.T, 6758.T, 9984.T">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="Failing probes: isin (7203.T, 6758.T, 9984.T).">❌</span> |
| <code>ETR</code><br><sub>Xetra</sub> | <span title="ZPRV.DE, ZPRX.DE, 5MVL.DE">ⓘ</span> | <span title="All probes passed. Attributes: price, name, currency.">✅</span> | <span title="All probes passed. Attributes: high, low, close.">✅</span> | <span title="All probes passed. Attributes: volume, tradetime, datadelay.">✅</span> | <span title="All probes passed. Attributes: change, changepct.">✅</span> | <span title="All probes passed. Attributes: isin.">✅</span> |

Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.
<!-- SUPPORT_MATRIX:END -->

This matrix is sample-based, not exhaustive. It is intended to show current practical coverage of the public interface, not a formal guarantee for every symbol on an exchange.

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

For local development, tests, CLI smoke checks, and support-matrix maintenance, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Limits

- Only single-result quote fields are supported
- Historical data arguments are not implemented
- `marketcap` is intentionally unsupported
- Quote freshness depends on the upstream source and may be delayed by an unspecified amount of time
- Public-site resolvers can break when upstream pages change
- `ibkr:isin` can be blocked by captcha on IBKR public pages

## License

This project is MIT-licensed.

## Detailed Reference

For the full API, ticker forms, array formulas, and source-specific notes, see [`hoodlefinance-api.md`](./hoodlefinance-api.md).

## Contributing

If you want to contribute, start with [`CONTRIBUTING.md`](./CONTRIBUTING.md).
