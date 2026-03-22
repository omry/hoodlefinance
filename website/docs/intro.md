---
sidebar_position: 1
slug: /
---

# HoodleFinance for Google Sheets

`HOODLEFINANCE` is a practical alternative to `GOOGLEFINANCE` for spreadsheets that need broader international coverage, identifier lookups, and built-in price conversion.

It is most useful when your sheets mix:

- international listings
- Yahoo-style symbols such as `SJPA.L` or `ZPRX.DE`
- direct ISIN inputs
- mixed-currency portfolios that benefit from `price@USD`-style output

## What It Does Well

- quote lookups on supported exchanges
- symbol, exchange, and ISIN resolution
- current-price conversion into a requested output currency
- practical coverage for many cases where `GOOGLEFINANCE` is too limited

## Quick Examples

```gs
=HOODLEFINANCE("NASDAQ:GOOG", "price")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
```

## Limits

- some lookups depend on public websites or unofficial endpoints
- upstream changes can break parts of the data surface without warning
- not every `GOOGLEFINANCE` attribute is supported
- support varies by market, exchange, identifier form, and source

## Source Code

HoodleFinance is developed in the open:

- Project repository: https://github.com/omry/hoodlefinance
