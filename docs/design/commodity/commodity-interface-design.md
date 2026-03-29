# Commodity Interface Design

This note defines the planned public interface for commodity support in `HOODLEFINANCE`, including identifier grammar, attribute grammar, normalization rules, and deferred scope.

It is an internal design note, not a user-facing support statement or release note.

## Design Summary

The planned model is:

- keep `HOODLEFINANCE` as the public surface
- use canonical commodity identifiers such as `COMMODITY:GOLD`
- return canonical normalized output from plain `price`, not source-native output
- keep source forcing on the identifier side with `@SOURCE`

In short:

- identifier = commodity subject
- attribute = requested fact about that commodity
- attribute qualifier = output representation or conversion request
- identifier `@...` suffix = source control

## Public Identifier Model

The canonical public commodity form is:

- `COMMODITY:<CODE>`

Examples:

- `COMMODITY:GOLD`
- `COMMODITY:BRENT`
- `COMMODITY:COPPER`
- `COMMODITY:IRON_ORE`

The implementation may also accept selected source-native aliases as secondary inputs, but those should normalize internally to one canonical commodity identifier.

Examples of acceptable internal alias concepts:

- a provider-specific energy benchmark code that normalizes to `COMMODITY:BRENT`
- a provider-specific metals symbol that normalizes to `COMMODITY:GOLD`

Forced-source routing remains on the identifier side:

- `COMMODITY:GOLD@CME`
- `COMMODITY:BRENT@FRED`
- `COMMODITY:IRON_ORE@SGX`

In v1, explicit futures contract selection is out of scope. The public interface does not yet expose a way to ask for a specific contract month or contract code.

If contract selection is added later, it should live on the identifier side rather than in the attribute grammar. A plausible future extension would be an identifier-side selector appended after `#`, for example:

- `COMMODITY:GOLD#2026.12_futures`
- `COMMODITY:GOLD#2026.12_futures@CME`

## Public Attribute Model

Commodity identifiers should continue to work with the existing core attributes:

- `price`
- `name`
- `currency`
- `symbol`
- `exchange`

These attributes take on commodity-aware meanings:

- `price` returns the canonical normalized commodity quote
- `name` returns the canonical commodity display name
- `currency` returns the canonical output currency for `price`
- `symbol` returns the canonical commodity identifier
- `exchange` returns the logical namespace, such as `COMMODITY`

Commodity support also adds these attributes:

- `unit`
- `source`
- `instrument_type`
- `native:price`
- `native:currency`
- `native:unit`
- `native:symbol`

Their intended meanings are:

- `unit`: canonical output unit for the default commodity quote
- `source`: resolved provider used for the quote, such as `EIA`, `FRED`, `CME`, `SGX`, `USDA`, or `ALPHAVANTAGE`
- `instrument_type`: normalized quote family such as `benchmark`, `spot`, `futures`, or `report`
- `native:price`: raw source quote before canonical normalization
- `native:currency`: source quote currency before canonical normalization
- `native:unit`: native backing-source unit before canonical normalization
- `native:symbol`: backing source symbol when the source exposes one

## Attribute Grammar

The commodity design extends the existing attribute grammar rather than introducing a new function.

| Form | Meaning |
| --- | --- |
| `price` | Canonical default currency and canonical default unit. |
| `price@EUR` | Canonical default unit, converted output currency. |
| `price:kg` | Canonical default currency, converted output unit. |
| `price:kg@EUR` | Converted output unit and converted output currency. |
| `native:price` | Raw source quote with no canonical normalization. |

Design rules:

- unit qualifiers apply only to commodity identifiers
- output-currency conversion continues to use the existing `@<currency>` suffix on the attribute
- `native:price` cannot be combined with output conversions
- invalid unit requests should fail clearly rather than guessing

Metadata for explicitly transformed outputs such as `price:kg@EUR` is deferred for now and should be revisited together with any future multi-attribute spill output design.

This preserves the current conceptual split:

- identifier-side `@SOURCE` is for route control
- attribute-side `:<qualifier>` and `@<currency>` are for output shaping

## Normalization Model

Commodity support should be driven by a repo-owned commodity registry.

Each commodity entry should define:

- canonical code
- display name
- canonical unit
- canonical currency
- unit family, initially `mass` or `volume`
- supported unit conversions within that family
- default provider priority
- default instrument type
- accepted aliases

The canonical `price` behavior is:

- fetch a quote from one resolved provider
- normalize it into the commodity's canonical default unit
- normalize it into the commodity's canonical default currency
- return that normalized result from plain `price`

The native/source-backed attributes expose the raw source-facing view:

- `native:price`
- `native:currency`
- `native:unit`
- `native:symbol`

This makes canonical output the public default, while still leaving the backing source values inspectable for debugging and advanced use.

Unit conversion should be family-restricted:

- mass units may convert only to other mass units
- volume units may convert only to other volume units
- cross-family conversions such as gold ounces to barrels must be rejected

This keeps output shaping physically coherent and avoids inventing commodity-specific density assumptions inside the generic formula surface.

The initial registry should keep this surface area small and start with `mass` and `volume`.
If broader commodity coverage later requires additional families, they should be added deliberately and documented alongside the commodity registry entries that depend on them.

## Routing Model

Commodity support should reuse the existing route framework.

The route model is:

- canonical commodity ids fan out to one or more provider routes
- provider order comes from the commodity registry
- the resolved source is returned by the `source` attribute
- fallback can switch providers without changing the canonical public symbol

Identifier-side `@SOURCE` keeps its current meaning:

- it forces a specific route family
- it disables fallback from that forced path

This keeps commodity routing consistent with the broader `HOODLEFINANCE` routing design rather than creating a separate source-control system.

## Deferred Scope

The following are intentionally out of scope for v1:

- explicit futures contract-month or contract-code syntax
- a separate commodity-specific custom function
- report-style agricultural extraction grammar
- multi-attribute spill output from one formula call

Those may become useful later, but they are not required for the first commodity interface.

If contract selection is introduced later, prefer an identifier-side selector such as `#...` so that:

- the identifier still carries subject and instrument-selection semantics
- the attribute grammar stays focused on output facts and output shaping
- identifier-side `@SOURCE` can retain its current routing meaning

The v1 goal is a stable canonical commodity surface, not a full commodity-discovery or contract-selection API.

## Examples

```gs
=HOODLEFINANCE("COMMODITY:GOLD")
=HOODLEFINANCE("COMMODITY:GOLD", "unit")
=HOODLEFINANCE("COMMODITY:GOLD", "price:kg")
=HOODLEFINANCE("COMMODITY:GOLD", "price:kg@EUR")
=HOODLEFINANCE("COMMODITY:GOLD@CME", "native:price")
=HOODLEFINANCE("COMMODITY:BRENT", "instrument_type")
```

Expected high-level meaning:

- the first example returns the canonical default gold quote
- `unit` shows the canonical default output unit
- `price:kg` converts the output into kilograms
- `price:kg@EUR` converts both the unit and the currency
- `native:price` exposes the raw quote from the forced source
- `instrument_type` reveals whether the chosen commodity representation is a benchmark, spot series, futures proxy, or report-style source

## Validation Plan

Validation should cover both parser logic and live routing behavior.

Parser and unit tests should cover:

- commodity identifier recognition for `COMMODITY:<CODE>`
- secondary alias normalization into canonical ids
- attribute parsing for `price`, `price@EUR`, `price:kg`, `price:kg@EUR`, and `native:price`
- rejection of invalid combinations such as `native:price@EUR`
- rejection of unsupported units for a commodity

Normalization tests should cover:

- canonical versus native price outputs
- canonical versus native currency outputs
- canonical versus native unit outputs
- commodity-specific unit conversion behavior

Routing tests should cover:

- source forcing with `@SOURCE`
- normal fallback between commodity providers
- stable canonical symbol behavior even when the backing route changes

Live smoke validation should cover at least one representative commodity from each major family that is implemented:

- energy
- precious metals
- industrial materials
- agricultural commodities

## Assumptions And Defaults

- canonical commodity ids are the documented public interface
- attribute-side syntax carries output unit and output currency requests
- canonical normalized `price` is the default behavior
- futures contract identity is deferred to a later design
