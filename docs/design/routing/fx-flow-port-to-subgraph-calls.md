---
status: Active
updated: 2026-04-19
summary: Current implementation note for the FX_CONVERSION subgraph-call migration.
---

# FX Flow Port To Subgraph Calls

## Summary

Port the current FX compatibility path from an ad-hoc mid-graph entry into a
named subgraph call once standalone subgraph-call support has landed.

This document depends on the generic runtime support described in
[`subgraph-call-support.md`](./subgraph-call-support.md). It is intentionally a
second step, not part of the initial infrastructure change.

This migration is now implemented in the TypeScript runtime. The notes below
capture the intended design plus the current production shape that replaced the
older compatibility seam.

## Current Implementation

Implemented behavior:

- `DagPlan.__subgraphs__.FX_CONVERSION` declares the FX branch as a named
  subgraph with `rootNodeId: "ATTRIBUTE:FX"` and
  `terminalNodeId: "EXTRACT:FX"`
- leaf resolvers receive a runtime `callSubgraph(subgraphId, input)` surface
- stock-unit normalization and `price@CCY` conversion invoke
  `callSubgraph("FX_CONVERSION", new FxRequest(...))`
- the numeric conversion rate is adapted locally from the subgraph's returned
  `LookupResult`
- `EXTRACT:EQUITY` advertises the subgraph relationship in graph rendering via
  `subgraphCalls: ["FX_CONVERSION"]`
- Mermaid rendering shows the FX call as a dotted edge from `EXTRACT:EQUITY`
  to the FX subgraph root

Implementation note:

- the original design discussion referred to plan-level glue around
  `request-resolution.ts` / `RequestResolutionDependencies`
- in the shipped code, the caller-side migration landed directly in
  `concrete-resolvers.ts` and receives runtime access through `ExecutionContext`
- the functional outcome matches the design intent even though the code path is
  simpler than originally described

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

### Runtime Surface

After migration, plan-level callers receive the generic subgraph runtime:

```ts
interface PlanRuntimeRefs {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}
```

The migrated behavior is:

- `callSubgraph("FX_CONVERSION", input)` is the only FX entrypoint
- the old `resolveFxQuote(...)` compatibility seam is removed

### Call Contract For FX Conversion

For the first FX migration pass, the subgraph input can remain close to the
existing `FxRequest` shape, because the runtime already knows how to route that
through the FX branch.

That means the first production call sites can look like:

```ts
callSubgraph("FX_CONVERSION", fxRequest)
```

The subgraph should preserve its current `LookupResult` envelope and resolved
FX value so spot-rate callers can use the FX result directly. Callers that need
only a numeric conversion rate may adapt that returned value locally.

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

Plan runtime surface after the FX migration:

```ts
interface PlanRuntimeRefs {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}
```

### Invariants

- callers must invoke FX through `callSubgraph("FX_CONVERSION", ...)` rather
  than through a dedicated runtime FX helper
- callers outside the subgraph registry must stop referring to `ATTRIBUTE:FX`
  and `EXTRACT:FX` directly
- migrated FX callers must preserve the current success/failure envelope model

## Rollout And Operations

### Phase 1: Remove The Current FX Compatibility Hook

- define `FX_CONVERSION` as the first production subgraph target
- make stock unit normalization and `price@CCY` invoke the named subgraph
  directly
- preserve current FX behavior while removing the old authored-node hack

### Phase 2: Move Other FX Callers To The Named Primitive

- migrate stock unit normalization and `price@CCY` helpers to the named
  subgraph
- stop referring to `ATTRIBUTE:FX` and `EXTRACT:FX` outside the subgraph
  registry

## Verification

Verified on 2026-04-19 with both targeted unit coverage and live smoke checks.

Unit tests:

- `node --test test-ts/concrete-resolvers.test.js`
- `node --test test-ts/resolve-flow.test.js`
- `node --test test-ts/spec-data.test.js`
- `node --test test-ts/plan-spec-dag-instantiation.test.js`
- `node --test test-ts/graph-mermaid.test.js`

Live checks:

- `npm run hoodlefinance.ts -- AAPL price@ILS` -> `799.8235977136001`
- `npm run hoodlefinance.ts -- PSE:BDO price@ILS` -> `5.938063506`
- `npm run hoodlefinance.ts -- LON:TSCO price@USD` -> `6.5618448`
- `npm run hoodlefinance.ts -- USDPHP=X price` -> `59.548`
- `npm run hoodlefinance.ts -- --mermaid` renders the dotted
  `call FX_CONVERSION` edge from `EXTRACT:EQUITY`

## Test Plan

- unit test that production FX callers invoke `FX_CONVERSION` directly
- unit test that stock unit normalization continues to use FX conversion
  semantics after the subgraph abstraction is adopted
- unit test that `price@CCY` still uses the same FX branch through the subgraph
  abstraction

## Decisions

- The FX subgraph preserves its current `LookupResult` envelope and resolved FX
  value so spot-rate callers can use the subgraph result directly.
- The old FX compatibility seam should be fully removed in this migration; no
  runtime trace or public interface should retain the old hack.
- Future batching should aggregate by unique FX pairs at the `FX_CONVERSION`
  call boundary so repeated identical FX requests collapse into a single
  subgraph call.
