---
status: Draft
updated: 2026-04-16
summary: Port the current FX compatibility path to the standalone subgraph-call primitive after the infrastructure support is in place.
---

# FX Flow Port To Subgraph Calls

## Summary

Port the current FX compatibility path from an ad-hoc mid-graph entry into a
named subgraph call once standalone subgraph-call support has landed.

This document depends on the generic runtime support described in
[`subgraph-call-support.md`](./subgraph-call-support.md). It is intentionally a
second step, not part of the initial infrastructure change.

## Problem

The current runtime reaches FX execution through an ad-hoc mid-graph entry at
`ATTRIBUTE:FX` and then relies on `EXTRACT:FX` as the implicit exit.

Today the runtime effectively does this:

- enter execution at `ATTRIBUTE:FX`
- let the FX branch resolve identity or provider-backed FX quotes
- rely on `EXTRACT:FX` to produce the final value

That shape has several problems:

- reuse depends on authored node ids rather than on an explicit graph contract
- callers must know where the reusable behavior starts and ends
- the runtime treats reuse as a disguised mid-graph jump
- changing the internal FX branch shape risks breaking callers that are coupled
  to specific node ids

This is also visible in stock unit normalization. `GBp -> GBP` and
`ILA -> ILS` are conceptually FX conversions, but the runtime still reaches FX
execution through a compatibility seam.

## Goals

- Define the current FX branch as a named subgraph migration target.
- Rewrite `resolveFxQuote(...)` as a compatibility wrapper over
  `callSubgraph(...)`.
- Preserve the current FX route behavior while removing direct caller coupling
  to `ATTRIBUTE:FX` and `EXTRACT:FX`.
- Make later FX callers such as stock unit normalization and `price@CCY`
  converge on the same subgraph primitive.

## Non-Goals

- Introduce standalone subgraph-call support in this document.
- Redesign the generic subgraph runtime interfaces.
- Solve future batching behavior in detail.

## Proposed Design

### First Production Migration Target

The first planned production migration target is the current FX path.

Suggested subgraph id:

- `FX_CONVERSION`

Initial registry entry:

```ts
FX_CONVERSION: {
  rootNodeId: "ATTRIBUTE:FX",
  terminalNodeId: "EXTRACT:FX",
}
```

This keeps the existing FX internals intact while removing caller awareness of
the internal node ids.

### Compatibility Surface

Before migration, the temporary runtime ref is:

```ts
interface PlanRuntimeRefs {
  resolveFxQuote(request: FxRequest): LookupResult;
}
```

After migration, the compatibility surface becomes:

```ts
interface PlanRuntimeRefs {
  resolveFxQuote(request: FxRequest): LookupResult;
  callSubgraph(subgraphId: string, input: object): LookupResult;
}
```

The migrated behavior is:

- `callSubgraph("FX_CONVERSION", input)` is the primary primitive
- `resolveFxQuote(...)` becomes a compatibility adapter implemented on top of
  `callSubgraph(...)`

### Call Contract For FX Conversion

For the first FX migration pass, the subgraph input can remain close to the
existing `FxRequest` shape, because the runtime already knows how to route that
through the FX branch.

That means the first FX compatibility layer can still look like:

```ts
callSubgraph("FX_CONVERSION", fxRequest)
```

The output should be normalized to a stable shape. The current runtime often
uses a bare extracted numeric value, but a richer result will age better:

```ts
interface FxConversionResult {
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
}
```

The migration does not need to switch callers to this richer result
immediately. It is enough for the compatibility wrapper to keep returning the
current `LookupResult` envelope while the internal direction stays explicit.

### Caller Model

Callers that currently rely on FX via runtime helper logic should move toward
one of these patterns:

- request a conversion rate from `FX_CONVERSION`
- request a normalized amount from a future higher-level money-conversion
  subgraph

For the current codebase, stock unit normalization and `price@CCY` conversion
can both be expressed as:

- determine source currency/unit from the quote
- determine target currency
- invoke `FX_CONVERSION`
- multiply the original amount by the returned rate

That keeps all currency and unit conversion semantics aligned with the FX
branch.

## Interfaces And Invariants

### Interfaces

Compatibility surface after the FX migration:

```ts
interface PlanRuntimeRefs {
  resolveFxQuote(request: FxRequest): LookupResult;
  callSubgraph(subgraphId: string, input: object): LookupResult;
}
```

### Invariants

- `resolveFxQuote(...)` must become a wrapper over a named subgraph rather than
  a direct mid-graph jump
- callers outside the subgraph registry must stop referring to `ATTRIBUTE:FX`
  and `EXTRACT:FX` directly
- migrated FX callers must preserve the current success/failure envelope model

## Rollout And Operations

### Phase 1: Port The Current FX Compatibility Hook

- define `FX_CONVERSION` as the first production subgraph target
- rewrite `resolveFxQuote(...)` as a compatibility wrapper over the subgraph
- preserve current FX behavior while removing direct authored-node coupling

### Phase 2: Move Other FX Callers To The Named Primitive

- migrate stock unit normalization and `price@CCY` helpers to the named
  subgraph
- stop referring to `ATTRIBUTE:FX` and `EXTRACT:FX` outside the subgraph
  registry

## Test Plan

- unit test that `resolveFxQuote(...)` delegates to the named subgraph path
- unit test that stock unit normalization continues to use FX conversion
  semantics after the subgraph abstraction is adopted
- unit test that `price@CCY` still uses the same FX branch through the subgraph
  abstraction

## Open Questions

- Should the first FX subgraph contract return a bare numeric rate or a
  structured conversion result object?
- At what point should stock unit normalization stop using a resolver-local
  compatibility wrapper and call the subgraph directly?
- When batching is added, should batching attach to repeated `FX_CONVERSION`
  subgraph calls or to provider leaf nodes underneath that subgraph?