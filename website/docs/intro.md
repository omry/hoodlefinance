---
sidebar_position: 1
sidebar_label: Introduction
slug: /
---

# HoodleFinance for Google Sheets

`HOODLEFINANCE` brings market data for U.S. and international listings, identifier lookups, and built-in currency conversion to Google Sheets.

It is most useful when your sheets mix:

- international listings
- Yahoo-style symbols such as `SJPA.L` or `ZPRX.DE`
- direct ISIN inputs
- mixed-currency portfolios that benefit from `price@USD`-style output

## What It Does

- quote lookups on supported exchanges
- symbol, exchange, and ISIN resolution
- current-price conversion into a requested output currency
- practical coverage for many cases where `GOOGLEFINANCE` is too limited

## Why It Is Useful

HoodleFinance is especially useful when you want spreadsheet formulas that map more closely to the way an international portfolio is actually managed.

- broader practical coverage for international listings and many foreign ETFs
- support for multiple identifier styles, including exchange-qualified symbols, Yahoo-style tickers, and direct ISIN input
- built-in price conversion so mixed-currency portfolios can be normalized in one formula step
- support for workflows that need exchange-qualified symbols, Yahoo-style tickers, ISINs, and currency-aware price output in the same sheet

## Quick Examples

```js
=HOODLEFINANCE("NASDAQ:GOOG", "price")   // U.S. stock price
=HOODLEFINANCE("SJPA.L", "price@USD")    // U.K. listing converted to USD
=HOODLEFINANCE("EURUSD", "price")        // FX pair price
=HOODLEFINANCE("PSE:BDO", "isin")        // ISIN lookup for a PSE ticker
=HOODLEFINANCE("IE00B4L5YX21", "symbol") // symbol resolved from a direct ISIN
```

See the [public demo sheet](/demo) for more live examples.

Bare tickers such as `GOOG` are often the easiest place to start. If a bare ticker does not resolve the way you want, especially for international or ambiguous symbols, switch to an explicit identifier such as `NASDAQ:GOOG` or `SJPA.L`.

For mixed-currency portfolios, `price@USD`-style formulas are often one of the biggest practical wins because they let you normalize prices into one comparison currency without a separate helper-column FX step.

## Installation

HoodleFinance currently has one practical installation path for general use, plus a future Marketplace path:

- **Manual Apps Script install:** the current install path for general use.
- **Google Workspace Marketplace add-on:** a future lower-friction install path.

For full step-by-step setup, update, add-on, and troubleshooting guidance, see the [Installation](installation) guide.

Today, the practical path is the manual Apps Script install. The Marketplace add-on is intended to become the lower-friction path later, but it is not publicly available yet.

## Limits

- some lookups depend on public websites or unofficial endpoints
- upstream changes can break parts of the data surface without warning
- not every `GOOGLEFINANCE` attribute is supported
- support varies by market, exchange, identifier form, and source

## Need More Coverage?

If a market, ticker format, ETF, or identifier lookup you care about is not working yet, please open an issue or contact [Support](/support).

## Source Code

HoodleFinance is developed in the open:

- Project repository: https://github.com/omry/hoodlefinance
- License: Mozilla Public License 2.0 (`MPL-2.0`)
