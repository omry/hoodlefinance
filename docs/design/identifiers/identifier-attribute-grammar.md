---
status: Active
updated: 2026-04-11
summary: Current identifier and attribute grammar model for HOODLEFINANCE.
---

# Identifier And Attribute Grammar

This note describes the grammar model that `HOODLEFINANCE` should be explained and extended with.

It focuses on two things:

- the current public design
- the forward design constraints that new features should preserve

It is intentionally not a change log.

The narrower note at `docs/design/identifiers/symbol-exchange-attributes.md` remains useful background for symbol/exchange output behavior. This document is the broader grammar note for identifiers, attributes, style qualifiers, and the currently reserved `@...` suffix space.

## Design Summary

The working model is:

- the identifier says what instrument or pair we want
- the attribute says what fact we want about it
- an attribute qualifier, when present, says how to render that fact
- an identifier suffix, when present, is reserved for deferred debug or routing controls and is not part of the current supported TypeScript runtime contract

In short:

- identifier = subject
- attribute = requested fact
- attribute qualifier = output style
- identifier `@...` suffix = reserved debug/routing space

That split is the main design rule for future additions.

## Current Public Identifier Grammar

### Bare Identifiers

The function accepts several bare identifier families:

- equity tickers such as `GOOG`
- Yahoo-style market-suffix symbols such as `SJPA.L`, `ZPRX.DE`, `9988.HK`, `D05.SI`, and `POLI.TA`
- six-character FX pairs such as `EURUSD`, `USDPHP`, and `BTCUSD`
- direct ISIN input such as `IE00B4L5YX21`

Bare identifiers are interpreted by detection rules rather than by one uniform prefix-based syntax.

### Prefix-Based Identifiers

The function also accepts identifiers of the form `PREFIX:VALUE`.

Examples:

- `NASDAQ:GOOG`
- `LON:SJPA`
- `ETR:ZPRX`
- `SGX:D05`
- `TLV:POLI`
- `PSE:BDO`
- `CURRENCY:EURUSD`
- `ISIN:IE00B4L5YX21`

These prefixes do not all play the same semantic role:

- exchange selectors such as `NASDAQ:`, `LON:`, and `SGX:`
- dedicated routing such as `PSE:`
- type namespaces such as `CURRENCY:` and `ISIN:`

The syntax is shared even when the meaning differs.

### Identifier Suffixes

Identifiers can also carry an optional trailing `@...` suffix.

Historical and deferred forms:

- `IDENTIFIER@SOURCE`
- `IDENTIFIER@?`
- `IDENTIFIER@`
- `IDENTIFIER@anything-unknown`

Current TypeScript runtime guidance:

- these forms are not part of the supported runtime lookup contract
- the current core parser still strips `@...` suffixes and recognizes debug-oriented info modes, but callers should not rely on source forcing through these forms
- future boundary-level debug tooling may reuse this suffix space deliberately, but that is deferred work rather than current support

Examples:

- `BTCUSD@YAHOO`
- `EURUSD@GOOGLE`
- `PSE:BDO@PSE`
- `ZPRX.DE@TRADINGVIEW`
- `GOOG@IBKR`
- `BTCUSD@?`
- `BTCUSD@`

These suffixes should be treated as reserved design space, not as a supported user-facing feature.

## Current Public Attribute Grammar

### Plain Attributes

Current plain attributes include:

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
- `symbol`
- `exchange`
- `isin`

### Style-Qualified Attributes

Some attributes use a `base:style` form:

- `symbol:google`
- `symbol:yahoo`
- `exchange:google`
- `exchange:yahoo`

Current defaults:

- `symbol` means the default symbol rendering
- `exchange` means the default exchange rendering

In practice those defaults currently align with the Google-style forms.

### `isin` As A Resolver Attribute

`isin` is a plain attribute name, but it is not a simple field read in all cases.

Its current model is:

- direct ISIN input returns the direct ISIN
- otherwise, the function infers an exchange-aware default resolver

Examples:

- `=HOODLEFINANCE("GOOG", "isin")`
- `=HOODLEFINANCE("PSE:BDO", "isin")`
- `=HOODLEFINANCE("SJPA.L", "isin")`
- `=HOODLEFINANCE("ZPRX.DE", "isin")`

This is an important design boundary:

- source selection for `isin` is currently inferred from the identifier rather than exposed as a public override
- formatting choice for values such as `symbol` and `exchange` lives on the attribute side

## Separator Semantics

### `:` In Identifiers

Inside identifiers, `:` currently means "explicit namespace boundary", but the namespace type varies:

- exchange selection in `NASDAQ:GOOG`
- dedicated project routing in `PSE:BDO`
- type selection in `CURRENCY:EURUSD`
- direct-ISIN input in `ISIN:IE00B4L5YX21`

So `:` is structurally consistent but semantically broad.

### `.` In Identifiers

Inside identifiers, `.` is used for Yahoo-style market suffixes:

- `.L`
- `.DE`
- `.HK`
- `.SI`
- `.TA`

This is a separate identifier family from the prefix-based `PREFIX:VALUE` forms.

### `:` In Attributes

Inside attributes, `:` means style qualification rather than instrument naming.

Examples:

- `symbol:yahoo`
- `symbol:google`
- `exchange:yahoo`
- `exchange:google`

So the same separator appears in both identifiers and attributes, but the two argument positions keep the meanings distinct.

### `@` In Identifiers

Inside identifiers, trailing `@...` is reserved for source and debug control.

Current status:

- `@...` is reserved suffix space for deferred debug/routing controls
- it is not part of the supported runtime lookup contract today

That reservation keeps provider-routing hints out of the attribute namespace even while the concrete feature remains deferred.

## Current Design Rules

The current design should be described with these rules:

1. Identifiers may carry subject information plus optional reserved suffix space for future routing/debug hints.
2. Attributes request facts about that subject.
3. Attribute qualifiers are for output style, not for resolver-source selection.
4. `isin` stays a plain attribute even when it dispatches through source-specific resolver logic.
5. If source forcing ever becomes public again, it should stay on the identifier side.

Those rules are more important than any one spelling detail.

## Current Constraints And Known Gaps

The current model is coherent, but a few limits should be kept explicit in design discussions.

### The Identifier Space Is Still Mixed

Identifiers currently combine several categories of information:

- subject identity
- exchange or namespace hints
- dedicated routing prefixes such as `PSE:`
- optional reserved debug/source suffixes

That is acceptable, but it means the identifier grammar is still broader than a pure "symbol only" model.

### Source Capability Is Not Uniform Across Attributes

Not every source participates in every attribute.

Today, the inferred source space includes a mix of:

- quote-oriented paths such as `YAHOO` and `GOOGLE`
- resolver-oriented paths such as `TRADINGVIEW`, `LON`, `ARIVA`, `IBKR`, and `PSE`

The important design point is not to force artificial uniformity. A shared source namespace is fine even when each attribute supports only a subset of sources.

### Deferred `@...` Debug Surfaces Need Explicit Boundaries

The older `@?`, `@`, and `@SOURCE` sketches are still useful as design references, but they are deferred from the current TypeScript runtime contract.

If route introspection returns in a supported way, it should be understood as route introspection rather than as a perfect explanation of every runtime branch that might run later.

## Forward Design

Future additions should preserve the same conceptual split:

- identifier chooses the subject
- identifier may optionally carry reserved routing/debug suffix space
- attribute chooses the requested fact
- attribute qualifier chooses representation style

That suggests the following direction.

### Keep Source On The Identifier Side If It Returns

New source-selection features should continue to live on the identifier side rather than re-entering the attribute namespace.

Good future fit:

- `IDENTIFIER@SOURCE`

Bad fit:

- new public forms such as `price:yahoo` or `isin:ibkr`

If internal testing hooks are ever added, they should not blur the public rule that any future source choice belongs with identifier routing.

### Keep Style On The Attribute Side

Style-oriented output forms belong on the attribute side.

This includes current patterns such as:

- `symbol:yahoo`
- `symbol:google`
- `exchange:yahoo`
- `exchange:google`

If more rendered-output variants are added later, they should align with this same rule.

### Treat Any Future Source Overrides As Debug/Advanced Surface

If `@SOURCE` forms return in the future, they should still be framed as advanced tooling:

- troubleshooting
- coverage inspection
- resolver verification
- source-specific smoke checks

That keeps the main user-facing API centered on the normal identifier plus attribute forms.

### Make Fallback Policy More Explicit If Needed

If future work needs richer introspection, it should come from an explicit routing/fallback model rather than from ad hoc exceptions.

The main candidate direction is:

- represent primary source, fallback candidates, and failure policy explicitly
- let `@?` or a future debug surface report that explicit model
- keep any future forced-source behavior strict and unsurprising

This is especially relevant for paths where the initial deduced route and the final successful route can differ.

### Preserve Compatibility For Core Identifier Families

The current identifier families are practical and already established:

- bare tickers
- Yahoo-style suffixed identifiers
- exchange-prefixed identifiers
- `CURRENCY:`
- `ISIN:`
- reserved identifier-side `@...` suffix space

Future cleanup should explain these forms more clearly, not replace them casually.

## Working Conclusion

The design to preserve is:

- identifier syntax carries subject selection and optional routing/debug hints
- the current supported runtime contract does not expose public source forcing
- attribute syntax carries fact selection
- attribute qualification carries output style
- any future source selection should stay on the identifier side

That model is strong enough to explain the current API and clear enough to guide future additions without drifting back toward source-specific attribute sprawl.
