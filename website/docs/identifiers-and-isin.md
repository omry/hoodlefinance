---
sidebar_position: 4
---

# Identifier Forms and ISIN

## Supported Identifier Forms

`identifier` accepts:

- a stock symbol without an exchange, such as `GOOG`
- a stock symbol with an exchange, such as `NASDAQ:GOOG` or `LON:SJPA`
- a Yahoo-style symbol, such as `SJPA.L` or `ZPRX.DE`
- a direct ISIN, such as `IE00B4L5YX21` or `PHY077751022`
- a currency pair, such as `EURUSD` or `CURRENCY:BTC.USDT`

Examples:

```gs
=HOODLEFINANCE("GOOG", "price")
=HOODLEFINANCE("LON:SJPA", "price")
=HOODLEFINANCE("SJPA.L", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("EURUSD", "price")
```

## PSE Tickers

`PSE:` tickers use a dedicated PSE EDGE route rather than Yahoo:

```gs
=HOODLEFINANCE("PSE:AAA", "price")
=HOODLEFINANCE("PSE:BDO", "name")
=HOODLEFINANCE("PSE:BDO", "isin")
```

## Direct ISIN Input

If the identifier itself is an ISIN, `HOODLEFINANCE` resolves it automatically before retrieving the requested attribute:

```gs
=HOODLEFINANCE("ISIN:IE00B4L5YX21", "price")
=HOODLEFINANCE("IE00B4L5YX21", "name")
=HOODLEFINANCE("PHY077751022", "name")
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

## Specific ISIN Sources

In normal use, `isin` should be enough. For debugging, coverage checks, and cases where you want to force a particular lookup path, use an identifier-side `@SOURCE` override.

Available source labels include:

- `@TRADINGVIEW`
- `@LON`
- `@PSE`
- `@ARIVA`
- `@IBKR`

Examples:

```gs
=HOODLEFINANCE("ZPRX.DE@TRADINGVIEW", "isin")
=HOODLEFINANCE("LON:SJPA@LON", "isin")
=HOODLEFINANCE("PSE:BDO@PSE", "isin")
=HOODLEFINANCE("ZPRV.DE@ARIVA", "isin")
=HOODLEFINANCE("ISJP.L@IBKR", "isin")
```
