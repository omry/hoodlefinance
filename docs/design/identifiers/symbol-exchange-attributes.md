---
status: Draft
updated: 2026-04-11
summary: Planned best-effort symbol and exchange output attributes.
---

# Symbol And Exchange Attributes

This note describes a best-effort identifier-resolution surface for `HOODLEFINANCE`.

The goal is to let users ask for the resolved symbol and exchange in either Yahoo-style or Google-style form, especially after direct ISIN input resolution. This is not a promise of perfect all-to-all identifier conversion. It is a practical, best-effort output layer on top of the identifier-resolution work the function already does.

## Attributes

Planned attributes:

- `symbol`
- `symbol:yahoo`
- `symbol:google`
- `exchange`
- `exchange:yahoo`
- `exchange:google`

Defaults:

- `symbol` means `symbol:google`
- `exchange` means `exchange:google`

No `ticker` alias is planned.

## Product Model

`HOODLEFINANCE` already accepts several input forms:

- direct ISIN input
- Google-style symbols such as `LON:SJPA`
- Yahoo-style symbols such as `SJPA.L`
- FX pairs such as `EURUSD` and `CURRENCY:EURUSD`

The new attributes should expose the resolved identifier in a requested style.

For the initial user-facing contract, this should be described consistently as a best-effort conversion layer from the supported Google-style, Yahoo-style, and direct ISIN inputs into the requested symbol or exchange style.

This is a best-effort system:

- if the requested conversion can be derived confidently, return it
- if it cannot be derived confidently, return a clear error

The system should not pretend that every instrument supports every conversion. Some exchanges have strong symbol-style mappings and some do not. Some instruments support `isin` well and some do not. That is acceptable as long as unsupported conversions fail explicitly instead of guessing.

## Initial Scope

The initial version should support:

- Google-style output
- Yahoo-style output
- FX pairs
- PSE instruments
- direct ISIN input where existing resolution already works

The feature should be described as:

- best-effort resolved identifier output
- not a complete or guaranteed all-to-all identifier conversion matrix

## Output Semantics

### `symbol:yahoo`

Return the canonical Yahoo-style symbol for the resolved instrument.

Examples:

- `GOOG`
- `SJPA.L`
- `KSM.F59.TA`
- `BDO.PS`
- `EURUSD=X`

Formula examples:

```gs
=HOODLEFINANCE("GOOG", "symbol:yahoo")
=HOODLEFINANCE("LON:SJPA", "symbol:yahoo")
=HOODLEFINANCE("PHY077751022", "symbol:yahoo")
=HOODLEFINANCE("EURUSD", "symbol:yahoo")
```

### `symbol:google`

Return the explicit Google-style or project-style symbol for the resolved instrument.

Examples:

- `NASDAQ:GOOG`
- `LON:SJPA`
- `TLV:KSM.F59`
- `PSE:BDO`
- `CURRENCY:EURUSD`

`symbol` should use the same behavior as `symbol:google`.

Formula examples:

```gs
=HOODLEFINANCE("GOOG", "symbol")
=HOODLEFINANCE("SJPA.L", "symbol:google")
=HOODLEFINANCE("PHY077751022", "symbol")
=HOODLEFINANCE("EURUSD", "symbol")
```

### `exchange:yahoo`

Return the Yahoo-side exchange identity that is already inferable from current quote metadata, suffix mapping, or explicit market routing.

Examples:

- `NMS`
- `LON`
- `PSE`
- `CURRENCY`

Formula examples:

```gs
=HOODLEFINANCE("GOOG", "exchange:yahoo")
=HOODLEFINANCE("SJPA.L", "exchange:yahoo")
=HOODLEFINANCE("PSE:BDO", "exchange:yahoo")
=HOODLEFINANCE("EURUSD", "exchange:yahoo")
```

### `exchange:google`

Return the normalized Google-style or project-style exchange code.

Examples:

- `NASDAQ`
- `NYSE`
- `NYSEARCA`
- `OTCMKTS`
- `LON`
- `ETR`
- `TLV`
- `SGX`
- `PSE`
- `CURRENCY`

`exchange` should use the same behavior as `exchange:google`.

Formula examples:

```gs
=HOODLEFINANCE("GOOG", "exchange")
=HOODLEFINANCE("SJPA.L", "exchange:google")
=HOODLEFINANCE("PHY077751022", "exchange")
=HOODLEFINANCE("EURUSD", "exchange")
```

## Mapping Rules

The implementation should reuse the existing inference logic where possible:

- Google-style to Yahoo-style normalization
- suffix-to-exchange mapping
- Yahoo metadata exchange mapping
- PSE explicit handling
- FX parsing metadata

Missing reverse rendering is acceptable only when it fails clearly.

The implementation should add the missing reverse mapping for common U.S. Yahoo/meta exchange codes:

- `NMS` -> `NASDAQ`
- `NYQ` -> `NYSE`
- `PCX` -> `NYSEARCA`
- `PNK` -> `OTCMKTS`

For PSE:

- `symbol:yahoo` should return `*.PS`
- `symbol:google` should return `PSE:*`
- both exchange attributes should return `PSE`

For FX:

- `symbol:yahoo` should return canonical pair plus `=X`
- `symbol:google` should return `CURRENCY:<PAIR>`
- both exchange attributes should return `CURRENCY`

## Error Policy

The new attributes should fail clearly when a requested conversion is not available.

Examples:

- no Google-style symbol could be reconstructed confidently
- no Yahoo-side exchange code is available
- an instrument resolves successfully but the requested style is unsupported for that market

The error policy should match the rest of the project:

- do not guess
- do not silently fall back to another style
- make the unsupported conversion explicit

## Why This Direction

This direction fits the existing project posture:

- broad input support
- practical current-data lookups
- best-effort exchange-specific behavior
- clear errors when a source or mapping is not available

The new identifier attributes should follow that same model rather than pretending to provide a perfect canonical conversion system.
