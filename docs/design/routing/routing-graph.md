---
status: Superseded
updated: 2026-04-11
summary: Earlier routing graph design superseded by the final ResolveFlow graph shape.
superseded_by: docs/design/routing/final-dag-shape-redesign.md
---

> Superseded note: this document describes an earlier routing graph design. For the current graph/runtime shape, see [`final-dag-shape-redesign.md`](./final-dag-shape-redesign.md).

# Routing Graph Design

## Motivation

The current routing pipeline is an implicit sequential procedure spread across
several functions: `buildResolvePlan`, `identifierPlan.resolve`,
`buildAttributePlan`, `attributePlan.resolve`, and `projectLookupValue`. The
full path from `RequestInput` to output value is only visible by reading all of
them together.

Converting the routing pipeline into an explicit DAG makes the entire path from
input to output a first-class data structure that can be inspected, tested, and
executed by a generic engine — without modifying any routing logic.

## Core Principle: the Plan is the Map

The existing resolver system already encodes all routing decisions as a
**plan** — a data structure that describes, for a given request, which resolvers
to try and in what order. `buildResolvePlan(requestInput)` is the map. It knows:

- Which classification applies (equity, FX, ISIN)
- Which identifier resolver to use (direct parsing vs ISIN search)
- Which quote resolvers to try, in order (`ATTRIBUTE:FX` →
  `[FX-IDENTITY, GOOGLE-FX]`; equity → `[YAHOO, TRADINGVIEW-FUND]`; PSE →
  `[PSE-FRAMES, PSE-EDGE]`)
- What fallback order the spec declares

The graph builder is a **compiler** — it reads this plan and turns it into a
graph. It does not restate routing decisions. If the resolver spec changes
(new source added, fallback order swapped), the graph changes automatically.

This is the key architectural constraint: **routing logic lives in the plan
spec, not in the graph builder**.

## The Routing Pipeline as a DAG

Each request compiles into a specific graph for that input. The nodes are pure
data structures with no routing logic of their own — the plan carries the
decisions, the engine carries the execution.

**Case 0 — ISIN attribute** (e.g. `AAPL isin`):

```
InputNode → IsinResolutionNode
```

No quote fetch. Exchange source is derived from the input itself (ticker prefix/suffix or ISIN country code).

**Case 1 — price without currency conversion** (e.g. `AAPL price`):

```
InputNode → PlanIdentifierNode → PlanQuoteNode → AttributeExtractionNode
```

**Case 2 — price with output currency conversion** (e.g. `AAPL price@USD`):

```
                                                  ┌─→ AttributeExtractionNode ─┐
InputNode → PlanIdentifierNode → PlanQuoteNode ───┤                            ├→ CurrencyConversionNode
                                                  └─→ FxRateBatchNode ─────────┘
```

`AttributeExtractionNode` is pure in-memory computation (no I/O), so the
parallelism here is real in the DAG sense but not meaningfully concurrent in
practice. The more significant parallelism is across multiple identifiers.

**Case 3 — multiple identifiers** (Phase 2; see [Phase 2](#phase-2-array-identifier-input-and-batch-dispatch)):

```
InputNode(AAPL) → PlanIdentifierNode → PlanQuoteNode(AAPL) ─┬─→ AttributeExtractionNode(AAPL) ─┐
                                                            │                                  ├─→ CurrencyConversionNode(AAPL)
                                                            ├──────────────→ FxRateBatchNode ──┤
                                                            │                                  ├─→ CurrencyConversionNode(MSFT)
InputNode(MSFT) → PlanIdentifierNode → PlanQuoteNode(MSFT) ─┴─→ AttributeExtractionNode(MSFT) ─┘
```

(`├` and `┤` represent fan-in/fan-out; in reality each `CurrencyConversionNode` joins only its own `AttributeExtractionNode` with the shared `FxRateBatchNode`.)

All `PlanQuoteNode`s that share the same underlying resolver (e.g. both AAPL and
MSFT going to Yahoo) are dispatched in a single `executeBatch` call. The shared
`FxRateBatchNode` then deduplicates FX pairs across the whole batch — if both
quotes come back in USD and the output currency is USD, only one FX lookup
occurs. This is where the DAG structure pays off: parallelism is structural, not
manually coordinated.


## Node Contracts

Each node in the DAG has:

- **Typed output** — `TOutput` is enforced at the interface level and passed to
  dependent nodes via the engine
- **Untyped inputs** — inputs arrive as `Record<string, NodeInput>` where
  `value` is `unknown`; each node retrieves its parent outputs using `getInput`
  and `getInputs`, which infer the expected type from the parent node's `TOutput`
  and throw on a missing parent
- **An `execute` function** — pure or side-effecting, depending on the node

```ts
interface RoutingNode<TOutput> {
  name: string;
  next: RoutingNode[];
  execute(inputs: Record<string, NodeInput>): TOutput;
}

// Helpers used inside execute() — type inferred from parent node's TOutput:
getInput(inputs, parentNode)          // single typed parent
getInputs(inputs, parentNodes)        // array of homogeneous parents (e.g. FxRateBatchNode)
```

## Node Hierarchy

> **Implementation status:**
> - Implemented: `InputNode`, `AttributeExtractionNode`, `CurrencyConversionNode`
> - Implemented (temporary): `FxRateBatchNode` — carries a design issue inherited
>   from the static graph; will be revisited when currency conversion is fixed there
> - Not yet implemented: `PlanIdentifierNode`, `PlanQuoteNode`
> - Not yet implemented: `buildRoutingGraph` — see [Routing Graph Construction](#routing-graph-construction)

> **Known issue — `AttributeExtractionNode` is not fully pure, and `ResolvePlan`
> is incomplete.** When `input.attributeType === "isin"`, the node performs a
> network call (TradingView / LON) that belongs in a dedicated `IsinResolutionNode`.
> The root cause is that `ResolvePlan` has no step for ISIN attribute resolution,
> so the builder cannot wire it as a graph node — it leaks into `AttributeExtractionNode`
> instead.
>
> `IsinResolutionNode` should be a direct child of `InputNode` (no quote needed):
> exchange determination is trivial from the input alone — ISIN country code prefix,
> ticker prefix/suffix (`PSE:`, `.L`), or explicit exchange. Quote metadata is only
> a last-resort fallback for bare tickers.
>
> The fix is to add `isinAttrPlan` to `ResolvePlan`. The builder then wires
> `IsinResolutionNode` mechanically without any `attributeType` check. Until then,
> `AttributeExtractionNode` accepts `isinDeps` as a temporary bridge.

The graph uses two generic plan-driven nodes plus pure-computation nodes for
attribute extraction and currency conversion. There are no resolver-specific
subclasses — the plan carries the routing decisions.

```
RoutingNode
  ├── InputNode                no resolver — holds RequestInput
  ├── PlanIdentifierNode       wraps identifierPlan or pre-resolved request        [not yet implemented]
  ├── PlanQuoteNode            wraps attributePlan or buildAttributePlan factory    [not yet implemented]
  ├── IsinResolutionNode       ISIN lookup — child of InputNode, not quote          [not yet implemented]
  ├── FxRateBatchNode          fetches FX rates after all quotes settle (see below) [temporary]
  ├── AttributeExtractionNode  no resolver — pure computation
  └── CurrencyConversionNode   no resolver — pure computation
```

`PlanIdentifierNode` and `PlanQuoteNode` delegate all resolver selection to the
plan. The "try each" fallback chain for quotes is executed inside
`executeRouteNode(attributePlan, resolved)` — the existing route execution
machinery already handles sequential fallback via `executeRouteJobs`.

## Routing Graph Construction

> **Status:** not yet implemented — `PlanIdentifierNode` and `PlanQuoteNode` must
> exist before this can be built. See [routing-graph-builder.ts](../../src/core/routing-graph-builder.ts).

`buildRoutingGraph(input: RequestInput): RoutingGraph` is pure and synchronous.
It calls `buildResolvePlan(input)` once and translates each plan step into a graph node.
The builder contains **no routing logic** — it only checks which steps the plan has
populated for this request, and wires a node for each one. Every decision about
which steps are needed, in what order, and with what resolvers is encoded in `ResolvePlan`.

```
plan step present?          → graph node
─────────────────────────────────────────────────────
(always)                    → InputNode
resolvePlan.identifierPlan  → PlanIdentifierNode
resolvePlan.attributePlan   → PlanQuoteNode + AttributeExtractionNode
resolvePlan.isinAttrPlan    → IsinResolutionNode  (replaces quote + extraction)
resolvePlan.fxPlan          → FxRateBatchNode + CurrencyConversionNode
```

> **Technical debt in `ResolvePlan`:** the plan currently has no step for ISIN
> attribute resolution (`attributeType === "isin"`). That lookup is instead
> special-cased inside `AttributeExtractionNode` via injected `isinDeps`. The fix
> is to add `isinAttrPlan` to `ResolvePlan` so the builder can wire
> `IsinResolutionNode` without any `if attributeType` check. Until then,
> `AttributeExtractionNode` carries `isinDeps` as a temporary bridge.

## Engine

The engine is a simple topological executor with no routing knowledge:

```
executeGraph(graph: RoutingGraph): EngineResult
```

1. Find nodes whose parents are all settled.
2. Call `node.execute(inputs)` — inputs are the settled outputs of all parents.
3. Mark node settled (with value) or failed (with error message).
4. Propagate failure: if any parent failed, skip the node without calling execute.
5. Repeat until queue is empty.

The engine has no concept of "try each," fallback, or resolver selection. Those
are plan concerns.


## Phase 2: Array Identifier Input and Batch Dispatch

> **Status:** not yet implemented. The design supports this structurally via
> `executorId` grouping, but the engine does not yet implement batch dispatch
> and `RequestInput` does not yet carry multiple identifiers. This section
> describes the intended future behavior.

`RequestInput` carries an array of identifiers, all requesting the same
attribute (e.g. a column of tickers all wanting `price`). Each identifier gets
its own subgraph from `InputNode` through to `OutputValue`, all built from the
single `RequestInput`. Batching happens at two points:

1. **Quote nodes** — `PlanQuoteNode` instances using the same underlying
   resolver (e.g. all YAHOO equity quotes) share the same `executorId`. The
   engine groups them and dispatches a single `executeBatch` call.
2. **`FxRateBatchNode`** — deduplicates FX pairs across the whole batch as
   described above.

## Relationship to Existing Resolver Classes

The plan-driven approach preserves all existing resolver implementations
unchanged. `PlanIdentifierNode` and `PlanQuoteNode` delegate to the plan, which
in turn delegates to the same `IdentifierResolver` and `RouteExecutionResolver`
subclasses that exist today. No resolver logic moves or changes.

What dissolves is the **graph builder's knowledge of resolver internals** — the
hardcoded classification branches and the per-resolver node subclasses.

```
PlanQuoteNode → executeRouteNode(attributePlan, resolved)
                    │
                    ▼
               attributePlan  (ResolverPlan from buildResolvePlan — the existing map)
                    │
                    ▼
               leaf resolvers  (YahooQuoteResolver, LocalFxResolver, etc. — unchanged)
```

## What This Replaces

| Current graph builder code | Replaced by |
| :--- | :--- |
| `if classification === "equity \|\| fx"` branch | `resolvePlan.resolvedRequest` present |
| `if classification === "isin"` with PH country code branch | `resolvePlan.identifierPlan` present |
| `SymbolFastForwardNode` | `PlanIdentifierNode` (equity/FX fast path) |
| `YahooIsinSearchNode`, `PseIsinMapNode` | `PlanIdentifierNode` (ISIN path, plan-selected) |
| `LocalFxNode`, `GoogleFxNode` | `PlanQuoteNode` (FX — plan selects FX-IDENTITY then GOOGLE-FX) |
| `YahooQuoteNode`, `TradingviewFundQuoteNode` | `PlanQuoteNode` (equity — plan selects YAHOO then TRADINGVIEW-FUND) |
| `PSEFramesQuoteNode`, `PSEEdgeQuoteNode` | `PlanQuoteNode` (PSE — plan selects PSE-FRAMES then PSE-EDGE) |
| `FirstSuccessNode` combinator | `executeRouteJobs` fallback inside plan execution |
| `RoutingGraphBuilderDependencies` (9 named resolvers) | `buildResolvePlan` (plan encodes all resolver selection) |

## Key Properties

**Single source of truth.** All routing decisions — which resolvers to try, in
what order, for what classification — live in the resolver plan specs. The graph
builder reads from that single source. Adding a new quote source means updating
the spec; the graph picks it up automatically.

**Conditional nodes.** `CurrencyConversionNode`, `FxRateBatchNode`, and
`PlanIdentifierNode` (ISIN path) are only added to the graph when the request
actually needs them. There is no runtime branching inside the engine.

**Inspectability.** The full routing path for any request is a subgraph that
can be walked, printed, or compared against expected structure in tests — before
any I/O happens.

**Sync-compatible.** `execute` on each node is synchronous. The engine does
not require `Promise`. Apps Script compatibility is preserved.
