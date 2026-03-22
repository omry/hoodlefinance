---
sidebar_position: 5
---

# Currency Conversion

`HOODLEFINANCE` supports spot currency conversion through the same function.

## Security Quotes in a Requested Output Currency

For security quotes, `price` can request an output currency directly:

```gs
=HOODLEFINANCE("SJPA.L", "price@USD")
=HOODLEFINANCE("ZPRX.DE", "price@USD")
=HOODLEFINANCE("NASDAQ:GOOG", "price@EUR")
```

## FX Identifier Forms

Accepted FX input forms include:

- bare pairs such as `EURUSD` or `USDPHP`
- prefixed pairs such as `CURRENCY:EURUSD` or `CURRENCY:ETHUSD`
- same-currency pairs such as `USDUSD`

Examples:

```gs
=HOODLEFINANCE("EURUSD", "price")
=HOODLEFINANCE("EURUSD", "name")
=HOODLEFINANCE("EURUSD", "changepct")
=HOODLEFINANCE("USDUSD", "price")
=HOODLEFINANCE("USDGBp", "currency")
```

## Notes

- output-currency conversion is only available through `price@<currency>`
- output-currency requests are not supported for non-price attributes
- output-currency requests are rejected for currency-pair identifiers
