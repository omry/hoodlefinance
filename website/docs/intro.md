---
sidebar_position: 1
sidebar_label: Introduction
slug: /
---

# HoodleFinance for Google Sheets

`HOODLEFINANCE` is a practical alternative to `GOOGLEFINANCE` for spreadsheets that need broader international coverage, identifier lookups, and built-in price conversion.

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

## Quick Examples

```js
=HOODLEFINANCE("NASDAQ:GOOG", "price")
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("IE00B4L5YX21", "symbol")
```

## Installation

HoodleFinance currently has two installation modes:

- **Manual Apps Script install:** the current install path for general use.
- **Google Workspace Marketplace add-on:** a future lower-friction install path.

### Manual Apps Script Install

This is the installation path you should use today.

1. Open a Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Copy the contents of [`hoodlefinance.js` (raw)](https://raw.githubusercontent.com/omry/hoodlefinance/main/hoodlefinance.js) into a new script file named `HoodleFinance`.
4. Save the Apps Script project.
5. Reload the spreadsheet.

The manual install also adds a `Hoodlefinance` menu in Sheets for version and update-related actions.

### Google Workspace Marketplace Add-On

The Marketplace add-on is intended to become the lower-friction install path, but it is not publicly available yet. The add-on path has already passed private Marketplace validation, while public Marketplace approval is still pending.

If and when the Marketplace add-on becomes publicly available, it should be treated as an alternative install method rather than something to combine with a pasted-script install in the same spreadsheet.

## Limits

- some lookups depend on public websites or unofficial endpoints
- upstream changes can break parts of the data surface without warning
- not every `GOOGLEFINANCE` attribute is supported
- support varies by market, exchange, identifier form, and source

## Source Code

HoodleFinance is developed in the open:

- Project repository: https://github.com/omry/hoodlefinance
