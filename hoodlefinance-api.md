# HOODLEFINANCE API

`HOODLEFINANCE` is a Google Apps Script custom function intended as a partial single-result replacement for `GOOGLEFINANCE`.

It uses Yahoo Finance for most quote data, PSE EDGE for `PSE:` tickers, and IBKR public contract pages for non-PSE `isin`.

## Advantages Over `GOOGLEFINANCE`

`HOODLEFINANCE` is useful where `GOOGLEFINANCE` is too limited or too inconsistent for the workflow.

Main advantages:

- Supports ticker forms that are practical for Yahoo-based ETF workflows, including Yahoo symbols such as `ISJP.L` and `ZPRX.DE`.
- Adds `name` and `currency` support using the same quote path as `price`, which makes the output more consistent across symbols.
- Adds `isin`, which `GOOGLEFINANCE` does not provide. This is especially useful for broker portability and execution workflows.
- Works better for many non-U.S. ETFs and UCITS listings that are awkward or inconsistent in `GOOGLEFINANCE`.
- Supports `PSE:` tickers directly from the Philippine Stock Exchange website instead of depending on Yahoo coverage.
- Normalizes `GBp` quotes into `GBP`, so price and currency are easier to work with in downstream formulas.
- Uses explicit exchange normalization rules instead of relying only on Google’s ticker recognition.

This does **not** mean `HOODLEFINANCE` is universally better:

- `GOOGLEFINANCE` is built into Sheets and is easier to share across spreadsheets.
- `GOOGLEFINANCE` supports historical data natively; `HOODLEFINANCE` does not.
- `HOODLEFINANCE` depends on external public endpoints, so some features are more brittle than a built-in function.

## Limitations

- Only single-result quote fields are supported.
- Historical data arguments are not implemented.
- `marketcap` is intentionally not supported.
- `isin` depends on IBKR public HTML pages rather than a clean public API.
- ISIN resolution is therefore more brittle than `price`, `name`, or `currency`.
- IBKR may present a captcha challenge on its public search pages; when that happens, `isin` lookups fail until the endpoint becomes accessible again.
- `PSE:` support depends on public PSE EDGE HTML pages, so it is more brittle than the Yahoo quote path.
- Not every Yahoo exchange code has a defensible IBKR mapping; unknown exchanges are left unmapped rather than guessed.
- The function is custom Apps Script code, so it is not as portable across spreadsheets as built-in `GOOGLEFINANCE`.
- The quote path depends on Yahoo public endpoints, which may change behavior without notice.

## Installation

1. Open the target Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Create or open `Code.gs`.
4. Paste the contents of `hoodlefinance.js` into the Apps Script project.
5. Save the project.
6. Reload the spreadsheet.
7. Test with a simple formula such as:

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
```

If Sheets reports `Unknown function: HOODLEFINANCE`, the Apps Script project did not load successfully. In that case:

- check for syntax errors in the Apps Script editor
- make sure the code was pasted into the spreadsheet's bound script project
- save the script and reload the sheet again

## Function Signature

```gs
=HOODLEFINANCE(ticker, [attribute], [startDate], [endDateOrNumDays], [interval])
```

Only the first two arguments are currently supported.

- `ticker`: required
- `attribute`: optional, defaults to `"price"`
- `startDate`: unsupported
- `endDateOrNumDays`: unsupported
- `interval`: unsupported

If any historical-data arguments are provided, the function throws an error.

## Supported Attributes

- `price`
- `name`
- `currency`
- `tradetime`
- `datadelay`
- `volume`
- `high`
- `low`
- `isin`
- `open`
- `close`
- `closeyest`
- `changepct`
- `change`

Attribute matching is case-insensitive.

Examples:

```gs
=HOODLEFINANCE("NASDAQ:GOOG")
=HOODLEFINANCE("NASDAQ:GOOG", "price")
=HOODLEFINANCE("NYSE:IBM", "name")
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
=HOODLEFINANCE("ISJP.L", "isin")
=HOODLEFINANCE("PSE:AAA", "price")
```

## Ticker Forms

### Native Yahoo symbols

These pass through unchanged:

```gs
=HOODLEFINANCE("ISJP.L", "price")
=HOODLEFINANCE("ZPRX.DE", "currency")
=HOODLEFINANCE("GOOG", "price")
```

### GOOGLEFINANCE-style exchange tickers

These are normalized to Yahoo symbols:

```gs
=HOODLEFINANCE("LON:ISJP", "price")   // -> ISJP.L
=HOODLEFINANCE("ETR:ZPRX", "price")   // -> ZPRX.DE
=HOODLEFINANCE("NASDAQ:GOOG", "price") // -> GOOG
```

### Currency pairs

Currency tickers use the `CURRENCY:` prefix:

```gs
=HOODLEFINANCE("CURRENCY:EURUSD", "price")
```

This normalizes to Yahoo's `EURUSD=X`.

### PSE tickers

Philippine listings can use the `PSE:` prefix:

```gs
=HOODLEFINANCE("PSE:AAA", "price")
=HOODLEFINANCE("PSE:BDO", "name")
=HOODLEFINANCE("PSE:BDO", "isin")
```

These do not go through Yahoo. They are resolved directly from public PSE EDGE company-directory and stock-data pages.

### ISIN-to-symbol lookup

If the input itself is an ISIN, `HOODLEFINANCE` resolves it to a Yahoo symbol first:

```gs
=HOODLEFINANCE("ISIN:IE00B4L5YX21", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
```

This resolution uses Yahoo search and is less robust than direct symbol lookup.

## `isin` Attribute

The `isin` attribute does **not** come from Yahoo quote metadata.

Instead, it:

1. returns a direct `quote.isin` value when the quote source provides one, such as `PSE:`
2. otherwise resolves the ticker to a Yahoo symbol for quote retrieval
3. strips Yahoo suffixes such as `.L` or `.DE` when searching IBKR
4. uses the original callsite ticker to infer a preferred IBKR exchange
5. scrapes IBKR public contract-detail pages for the first matching ISIN

Examples:

```gs
=HOODLEFINANCE("PSE:BDO", "isin")
=HOODLEFINANCE("ISJP.L", "isin")
=HOODLEFINANCE("ZPRX.DE", "isin")
=HOODLEFINANCE("LON:ISJP", "isin")
=HOODLEFINANCE("ETR:ZPRX", "isin")
=HOODLEFINANCE("LSEETF:ISJP", "isin")
=HOODLEFINANCE("IBIS:ZPRX", "isin")
```

For non-PSE tickers, the resolver:

1. resolves the ticker to a Yahoo symbol for quote retrieval
2. strips Yahoo suffixes such as `.L` or `.DE` when searching IBKR
3. uses the original callsite ticker to infer a preferred IBKR exchange
4. scrapes IBKR public contract-detail pages for the first matching ISIN

### Exchange inference for `isin`

The resolver can infer or accept an IBKR exchange hint:

- Yahoo exchange codes are mapped to IBKR exchange codes via dictionary
- Yahoo suffixes such as `.L` and `.DE` are mapped to IBKR exchange codes via dictionary
- explicit IBKR exchange codes at the callsite override both

Examples:

- `LON:ISJP` -> `LSEETF`
- `ISJP.L` -> `LSEETF`
- `ETR:ZPRX` -> `IBIS`
- `ZPRX.DE` -> `IBIS`
- `LSEETF:ISJP` -> `LSEETF`
- `IBIS:ZPRX` -> `IBIS`

This is intended to improve resolution when the same symbol exists on multiple exchanges.

## Array Usage in Google Sheets

`HOODLEFINANCE` is scalar, so use `MAP` for spilled columns.

Price:

```gs
={"Price"; MAP(A3:A, LAMBDA(x, IF(x="","",HOODLEFINANCE(x,"price"))))}
```

Currency:

```gs
={"Currency"; MAP(A3:A, LAMBDA(x, IF(x="","",HOODLEFINANCE(x,"currency"))))}
```

Name:

```gs
={"Name"; MAP(A3:A, LAMBDA(x, IF(x="","",HOODLEFINANCE(x,"name"))))}
```

ISIN:

```gs
={"ISIN"; MAP(A3:A, LAMBDA(x, IF(x="","",HOODLEFINANCE(x,"isin"))))}
```

## Notes and Limitations

- Historical arguments are not implemented.
- `marketcap` is intentionally not supported.
- `isin` depends on IBKR public HTML pages, so it is more brittle than quote attributes.
- Not every Yahoo exchange code has a defensible IBKR mapping; unknown exchanges are left unmapped rather than guessed.
- `changepct` returns a fraction such as `0.0123` for `1.23%`, so format the cell as Percent in Sheets.
- `GBp` quotes are normalized to `GBP`: money values are divided by 100 and the reported currency is changed to `GBP`.
