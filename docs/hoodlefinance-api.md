# HOODLEFINANCE API

`HOODLEFINANCE` is a Google Apps Script custom function for Google Sheets. It is meant to cover practical current-data use cases where `GOOGLEFINANCE` is too limited, especially for non-U.S. listings, Yahoo-style symbols, and ISIN lookups.

Current script version: `0.9.1`
Current release notes: [`release-notes/v0.9.1.md`](./release-notes/v0.9.1.md)

Release notes: [`release-notes/RELEASE_NOTES.md`](./release-notes/RELEASE_NOTES.md)

For sampled live coverage by exchange, see [support-matrix.md](../support-matrix.md).

## What It Is Good At

- Current quote fields for many Yahoo-covered markets
- Yahoo-style symbols such as `SJPA.L`, `ZPRX.DE`, `9988.HK`, `D05.SI`, and `POLI.TA`
- Exchange-prefixed inputs such as `LON:SJPA`, `ETR:ZPRX`, `SGX:D05`, `TLV:POLI`, and `PSE:BDO`
- Direct ISIN input such as `IE00B4L5YX21` or `PHY077751022`
- Exchange-specific ISIN lookups through `isin` and identifier-side source overrides such as `@LON` or `@PSE`

## Where `GOOGLEFINANCE` Is Still Better

- It is built into Sheets, so it is easier to share across spreadsheets
- It supports historical data natively
- It does not depend on external public endpoints that may change without notice

## Installation

1. Open the target Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Create a new script file named `HoodleFinance`.
4. Paste in the contents of [`hoodlefinance.js`](../hoodlefinance.js).
5. Save the project.
6. Reload the spreadsheet.

Start with a simple check:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```

If Sheets reports `Unknown function: HOODLEFINANCE`, check that the script was pasted into the bound Apps Script project, saved successfully, and reloaded in the sheet.

## Functions

```gs
=HOODLEFINANCE(identifier, [attribute])
```

```gs
=HOODLEFINANCE_VERSION()
```

Implemented today:

- `identifier`: required
- `attribute`: optional, defaults to `"price"`

Here, `identifier` means the query input accepted by the function:

- a stock symbol without an exchange, such as `GOOG`
- a stock symbol with an exchange, such as `NASDAQ:GOOG` or `LON:SJPA`
- a Yahoo-style symbol, such as `SJPA.L` or `ZPRX.DE`
- an input ISIN, such as `IE00B4L5YX21` or `PHY077751022`

The function still accepts the broader `GOOGLEFINANCE`-style call shape for compatibility:

```gs
=HOODLEFINANCE(identifier, [attribute], [startDate], [endDateOrNumDays], [interval])
```

But the historical-style arguments are not implemented:

- `startDate`: unsupported
- `endDateOrNumDays`: unsupported
- `interval`: unsupported

If any of those extra arguments are supplied, the function throws an error.

`HOODLEFINANCE_VERSION()` returns the version string embedded in the pasted script.

## Supported Attributes

Attribute matching is case-insensitive.

`GOOGLEFINANCE`-like quote attributes:

- `price`
- `name`
- `currency`
- `tradetime`
- `datadelay`
- `volume`
- `high`
- `low`
- `close`
- `change`
- `changepct`

Additional `HOODLEFINANCE`-only attributes:

- `symbol[:google|:yahoo]`: returns the resolved symbol in Google-style or Yahoo-style form
- `exchange[:google|:yahoo]`: returns the resolved exchange code in Google-style or Yahoo-style form
- `isin`: returns the resolved ISIN when an exchange-specific lookup path is available

Behavior notes:

- `price` is the default attribute.
- `close` returns the previous close price.
- `changepct` returns a fraction such as `0.0123` for `1.23%`. Format the cell as Percent in Sheets.
- `tradetime` returns a Sheets date-time value when the upstream source provides one.
- `datadelay` is source-dependent and should be treated as advisory, not a guarantee of freshness.
- `GBp` quotes are normalized to `GBP`, and `ILA` quotes are normalized to `ILS`. Money values are divided by `100` when that normalization applies.
- `symbol` defaults to Google-style output such as `LON:SJPA` or `CURRENCY:EURUSD`.
- `exchange` defaults to Google-style output such as `LON`, `NASDAQ`, `PSE`, or `CURRENCY`.
- `symbol:yahoo` and `exchange:yahoo` return Yahoo-style identifier output when that conversion is available.
- These identifier-style attributes are best-effort conversions from the supported Google-style, Yahoo-style, and direct ISIN inputs into the requested symbol or exchange style.
- Some conversions are not available for every market or instrument, and unsupported conversions return a clear error instead of guessing.
- If an upstream source does not provide a requested field, the formula returns an error for that lookup.

Examples:

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
=HOODLEFINANCE("IJPA.L", "exchange")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
```

## Supported Identifier Forms

### Bare Tickers

Bare stock symbols pass through unchanged and work best for familiar U.S. names:

```gs
=HOODLEFINANCE("GOOG", "price")
=HOODLEFINANCE("IBM", "name")
```

### Exchange-Prefixed Tickers

Many exchange-prefixed stock symbols are accepted directly:

```gs
=HOODLEFINANCE("LON:SJPA", "price")
=HOODLEFINANCE("ETR:ZPRX", "price")
=HOODLEFINANCE("HKG:9988", "price")
=HOODLEFINANCE("SGX:D05", "price")
=HOODLEFINANCE("TLV:POLI", "price")
=HOODLEFINANCE("NEO:ZTL", "price")
=HOODLEFINANCE("OTCMKTS:RYCEY", "price")
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```

### Yahoo-Style Symbols

Yahoo-style symbols are also accepted:

```gs
=HOODLEFINANCE("SJPA.L", "price")
=HOODLEFINANCE("ZPRX.DE", "currency")
=HOODLEFINANCE("9988.HK", "price")
=HOODLEFINANCE("D05.SI", "name")
=HOODLEFINANCE("POLI.TA", "price")
```

### Currency Pairs

Currency pairs can be passed either as bare pairs or with the `CURRENCY:` prefix:

```gs
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("BTCUSD", "price")
=HOODLEFINANCE("DOGEUSD", "price")
=HOODLEFINANCE("USDUSDT", "price")
=HOODLEFINANCE("CURRENCY:BTC.USDT", "price")
=HOODLEFINANCE("CURRENCY:ETHUSD", "price")
```

Canonical 3-letter codes such as `USD`, `EUR`, `GBP`, `ILS`, and `PHP` remain the base form. Supported crypto or unit codes can now be either 3 or 4 characters, so unambiguous pairs such as `DOGEUSD`, `USDUSDT`, and `USDCUSDT` are also recognized in the same syntax.

By default, currency pairs now route through Google Finance quote pages rather than Yahoo chart lookups. That improves practical coverage for pairs that Yahoo often misses, such as `PHPILS`.

Some upstream quote-unit aliases are also accepted. For example, `GBpUSD`, `USDGBp`, `ILAUSD`, and `USDILA` are normalized through the corresponding canonical Yahoo FX symbol, while the returned value and `currency` still reflect the requested units.

If a compact `CURRENCY:` pair would be ambiguous once 3- and 4-character legs are considered, `HOODLEFINANCE` raises a direct ambiguity error and tells you to rewrite it with dotted prefixed syntax such as `CURRENCY:<base>.<quote>`. Dotted prefixed syntax also works for unambiguous 4-character-leg pairs such as `CURRENCY:BTC.USDT`.

If the base and quote currency are the same, `HOODLEFINANCE` short-circuits locally and returns `1`:

```gs
=HOODLEFINANCE("USDUSD", "price")
=HOODLEFINANCE("CURRENCY:USDUSD", "price")
=HOODLEFINANCE("CURRENCY:USDT.USDT", "price")
```

This is a practical improvement over `GOOGLEFINANCE` for some portfolio sheets because it simplifies currency-normalization formulas when multiple positions are already denominated in the target currency.

### PSE Tickers

`PSE:` tickers do not go through Yahoo. They are resolved from public PSE EDGE pages:

```gs
=HOODLEFINANCE("PSE:AAA", "price")
=HOODLEFINANCE("PSE:BDO", "name")
=HOODLEFINANCE("PSE:BDO", "isin")
```

The support matrix includes sample Yahoo-style PSE inputs such as `BDO.PS`, `AAA.PS`, and `JFC.PS`. Use `PSE:` when you want the dedicated PSE path described in this page.

### Direct ISIN Input

If the identifier itself is an ISIN, `HOODLEFINANCE` resolves it automatically before retrieving the requested attribute:

```gs
=HOODLEFINANCE("ISIN:IE00B4L5YX21", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("PHY077751022", "name")
```

### Debug Source Suffixes

For troubleshooting and source-coverage checks, identifiers also support a small debug suffix surface:

- `IDENTIFIER@SOURCE`: force a specific source for that lookup and disable fallback
- `IDENTIFIER@?`: return the currently deduced source name
- `IDENTIFIER@` or `IDENTIFIER@anything-unknown`: return the supported source list

Examples:

```gs
=HOODLEFINANCE("BTCUSD@YAHOO", "price")
=HOODLEFINANCE("EURUSD@GOOGLE", "price")
=HOODLEFINANCE("BTCUSD@?")
=HOODLEFINANCE("BTCUSD@")
```

These forms are primarily meant for debugging and sheet-level troubleshooting rather than normal portfolio formulas.

## Currency Conversion

`HOODLEFINANCE` also supports spot currency conversion through the same function.

Accepted FX input forms include:

- bare pairs such as `EURUSD` or `USDPHP`
- prefixed pairs such as `CURRENCY:EURUSD` or `CURRENCY:ETHUSD`
- same-currency pairs such as `USDUSD`

For FX pairs, the most consistently available attributes are:

- `price` as the current conversion rate
- `name` as the currency-pair label
- `currency` as the quote currency or quote unit
- `close`, `change`, and `changepct`
- `tradetime` and `datadelay` when the upstream source provides them

Compared with typical `GOOGLEFINANCE` FX usage, `HOODLEFINANCE` adds a few practical improvements:

- Same-currency pairs such as `USDUSD` return `1`, which simplifies normalization formulas.
- Upstream quote-unit aliases such as `GBp` and `ILA` are accepted, while returned values and `currency` still reflect the requested units.
- In practice, FX pairs expose more than a price-only workflow, including `close`, `change`, `changepct`, `currency`, `tradetime`, and `datadelay`, while some fields still depend on what Google publishes for the requested pair.

Some Google-quoted FX pairs do not expose `high`, `low`, or `volume`. When Google does not publish those fields for the requested pair, `HOODLEFINANCE` reports them as unavailable instead of backfilling them from another source.

Examples:

```gs
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("EURUSD", "name")
=HOODLEFINANCE("EURUSD", "high")
=HOODLEFINANCE("EURUSD", "changepct")
=HOODLEFINANCE("USDUSD", "price")
=HOODLEFINANCE("USDGBp", "currency")
```

## How `isin` Works

`isin` is the generic ISIN attribute. It tries to infer the exchange from the input identifier, Yahoo suffix, or quote metadata, then dispatches to an exchange-specific resolver.

If the exchange cannot be inferred, or if no default ISIN source is configured for that exchange, the function throws a clear error and tells you to use an explicit source attribute.

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("LON:SJPA", "isin")
=HOODLEFINANCE("GOOG", "isin")
=HOODLEFINANCE("PSE:BDO", "isin")
```

For current practical coverage, see [support-matrix.md](../support-matrix.md).

## Specific ISIN Sources

In normal use, `isin` should be enough. For debugging, coverage checks, and cases where you want to force a particular lookup path, use an identifier-side `@SOURCE` override.

That keeps source forcing on the identifier side while leaving attributes such as `symbol:yahoo` and `exchange:google` focused on output style.

`@TRADINGVIEW`: uses the public TradingView symbol page and extracts `isin_displayed` from the page bootstrap data. This is the main default path for many exchange-based identifiers.

`@LON`: uses public London Stock Exchange search results and extracts the ISIN from the structured listing row.

`@PSE`: uses the public PSE EDGE stock-data page and only works for `PSE:` identifiers or PSE-mapped ISINs.

`@ARIVA`: uses ARIVA public search and detail pages. It is intentionally narrow: only `ETR` and `.DE` identifiers are supported, and the search result must expose a matching Xetra listing.

`@IBKR`: scrapes public Interactive Brokers contract-detail pages. It does not come from Yahoo quote metadata.

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE@TRADINGVIEW", "isin") // direct TradingView source
=HOODLEFINANCE("LON:SJPA@LON", "isin")        // direct London Stock Exchange source
=HOODLEFINANCE("PSE:BDO@PSE", "isin")         // direct PSE source
=HOODLEFINANCE("ZPRV.DE@ARIVA", "isin")       // direct ARIVA source
=HOODLEFINANCE("ISJP.L@IBKR", "isin")         // direct IBKR source
```

## Array Usage

`HOODLEFINANCE` accepts ticker ranges directly and spills a result grid with the same shape.

Examples:

```gs
={"Price"; HOODLEFINANCE(A3:A, "price")}
```

```gs
={"Currency"; HOODLEFINANCE(A3:A, "currency")}
```

```gs
={"Name"; HOODLEFINANCE(A3:A, "name")}
```

```gs
={"ISIN"; HOODLEFINANCE(A3:A, "isin")}
```

Range behavior:

- blank ticker cells stay blank in the spilled output
- if any populated lookup fails, Sheets surfaces a single error for the whole spill range

## Update Checks

When the script is installed in a bound spreadsheet, it adds a `Hoodlefinance` menu with:

- `Check for updates`
- `Show installed version`
- `Suppress automatic update checks` or `Enable automatic update checks`

Automatic update checks run at most once per day per user when the spreadsheet opens. If a newer version is found, the script shows a dialog with links to the release notes, raw source, README, and repository.

Suppressing update checks only disables the automatic once-per-day check. Manual checks from the menu still work.

## Limitations

- Current-data attributes only. Historical series are not implemented.
- `marketcap` is currently unsupported.
- Quote freshness depends on upstream sources and may be delayed by an unspecified amount of time.
- `isin` only works for exchanges with an implemented resolver. Quote support is broader than ISIN support.
- `isin` is not available for currency pairs.
- `@IBKR`, `@TRADINGVIEW`, `@LON`, `@ARIVA`, and the `PSE:` path all depend on public websites or unofficial endpoints and may break if those sites change.
- `@IBKR` can fail when IBKR presents a captcha challenge.
- Some attributes may be unavailable for a specific listing even when the exchange is generally supported.
- The function is pasted Apps Script code, so it is less portable than built-in `GOOGLEFINANCE`.
