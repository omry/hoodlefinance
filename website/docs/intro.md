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

## Documentation

- Support and project links: [Support](./support.md)
- Privacy policy: [Privacy Policy](./privacy-policy.md)
- Terms of service: [Terms of Service](./terms-of-service.md)
- Full project repository: https://github.com/omry/hoodlefinance
- Public demo sheet: https://docs.google.com/spreadsheets/d/1734VkJOGy621MGf431DCMPtB_Pp0235LIKMSG9YmRY4/edit?usp=sharing

## Current Install Paths

- the current supported public path is the manual bound-script install described in the repository docs
- the Google Sheets add-on path has been validated privately and is being prepared for public review

## Limits

- some lookups depend on public websites or unofficial endpoints
- upstream changes can break parts of the data surface without warning
- not every `GOOGLEFINANCE` attribute is supported
- support varies by market, exchange, identifier form, and source

For broader usage details and examples, see the main project documentation on GitHub.
