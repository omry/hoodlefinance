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

## The Routing Pipeline as a DAG

The DAG is built to match the request. Classification (`"equity"`, `"isin"`, or
`"fx"`) happens before graph construction, so the graph is pre-shaped for the
request — no switch nodes are needed at runtime.

Each request follows a path through a graph of routing nodes. The shape of the
path depends on the request classification and the resolved exchange.

```
┌──────────────────┐
│  InputNode       │  root — holds RequestInput, no deps
└──────┬───────────┘
       │                         │
  [equity / isin]               [fx]
       │                         │
       ▼                         ▼
SymbolFastForwardNode    LocalFxNode /
YahooIsinSearchNode      GoogleFxNode
PseIsinMapNode
       │                         │
       ▼                         │
FirstSuccessNode (quote)         │
  PSEFrames + PSEEdge            │
  — or —                         │
  Yahoo + TradingviewFund        │
       │                         │
       └──────────┬──────────────┘
                  │  (paths converge)
                  ▼
        AttributeExtractionNode
                  │
         ┌────────┴──────────────────┐
         │                           │
         ▼                    (if price@CURRENCY)
    OutputValue                      │
                                     ▼
                             FxRateBatchNode
                                     │
                                     ▼
                           CurrencyConversionNode
                                     │
                                     ▼
                                OutputValue
```

The `"isin"` classification is for requests where the input ticker **is** an
ISIN (e.g. `US0378331005`) — the identifier must be resolved to a symbol and
exchange before a quote can be fetched. This is distinct from the `isin`
*attribute* request (where the user asks for the ISIN value of a known ticker),
which selects its source node statically from the resolved exchange at build time.

## Node Contracts

Each node in the DAG has:

- **Typed inputs** — the settled outputs of its dependency nodes, received in
  `deps` order
- **Typed output** — passed to dependent nodes
- **An `execute` function** — pure or side-effecting, depending on the node

```ts
interface RoutingNode<TInput, TOutput> {
  id: string;          // stable, deterministic key for dedup
  deps: RoutingNode[]; // nodes that must settle before this one
  execute(...depOutputs: unknown[]): TOutput;
}
```

Every node receives the settled outputs of its `deps` in order. Root nodes
(`deps: []`) receive nothing and return their pre-held value. The engine calls
all nodes uniformly — it has no concept of "root" vs "interior."

## Node Hierarchy

`RoutingNode` has a concrete subclass for each distinct resolver role. Nodes
that wrap a leaf resolver own that relationship directly — typed inputs in,
typed call to the resolver, typed output out.

```
RoutingNode (abstract)
  ├── InputNode                    no resolver — holds one identifier from RequestInput
  ├── SymbolFastForwardNode        wraps DirectIdentifierResolver
  ├── YahooIsinSearchNode          wraps YahooIsinSearchResolver
  ├── PseIsinMapNode               wraps PseIsinMapResolver
  ├── LocalFxNode                  wraps LocalFxResolver
  ├── GoogleFxNode                 wraps GoogleFxResolver
  ├── YahooQuoteNode               wraps YahooQuoteResolver
  ├── PSEEdgeQuoteNode             wraps PSEEdgeResolver
  ├── PSEFramesQuoteNode           wraps PSEFramesResolver
  ├── TradingviewFundQuoteNode     wraps TradingviewFundResolver
  ├── FxRateBatchNode              wraps GoogleFxResolver (batch, see below)
  ├── AttributeExtractionNode      no resolver — pure computation
  ├── CurrencyConversionNode       no resolver — pure computation
  └── FirstSuccessNode             combinator — see below
```

The graph builder selects which quote node subclass(es) to use based on the
resolved exchange and request type. `FirstSuccessNode` wraps an ordered list of
candidates and tries them in sequence; multiple instances may appear in one
graph.

## Graph Construction

Building the DAG for a request is pure and synchronous. The builder reads the
request and wires the appropriate node subclasses:

```
buildRoutingGraph(input: RequestInput): RoutingGraph
```

For each identifier in `input.identifiers`:

1. Create `InputNode(identifier, input)` — the graph root for this identifier.
2. Branch on classification (determined before graph construction):
   - `"equity"` → `SymbolFastForwardNode(inputNode)`
   - `"isin"` → select ISIN resolver by country code (first two chars of ISIN):
     - `"PH"` → `PseIsinMapNode(inputNode)`
     - default → `YahooIsinSearchNode(inputNode)`
   - `"fx"` → `LocalFxNode` or `GoogleFxNode(inputNode)`
3. For `"equity"` and `"isin"` paths, select and wire the appropriate quote
   `FirstSuccessNode`. The exchange is knowable at build time from the ticker
   string (equity) or ISIN country code (isin):
   - PSE exchange → `FirstSuccessNode([PSEFramesQuoteNode, PSEEdgeQuoteNode])`
   - other equity → `FirstSuccessNode([YahooQuoteNode, TradingviewFundQuoteNode])`
4. Wire `AttributeExtractionNode(quoteOrFxNode, inputNode)`.
   - For `isin` attribute requests, the builder selects the ISIN source node
     statically from the resolved exchange: `LON` → `LonNode`, `PSE` →
     `PseIsinAttributeNode`, default → `TradingviewIsinNode`. ARIVA and IBKR
     are only reachable via `@SOURCE` override.
5. If attribute includes output currency:
   - Wire `FxRateBatchNode` (shared across all inputs — see below).
   - Wire `CurrencyConversionNode(attributeExtractionNode, fxRateBatchNode)`.

The builder is the only place where routing decisions are made. The plan
resolver classes (`ResolverPlan`, `IdentifierResolutionPlan`,
`FxAttributeResolutionPlan`) dissolve here — their `getNodesForRequest` logic
becomes graph wiring decisions, not class logic.

## Engine

The engine is a simple topological executor with no routing knowledge:

```
executeGraph(graph: RoutingGraph, env: ExecutionEnv): SettledGraph
```

1. Find nodes whose deps are all settled.
2. Group by executor id (enables batching across identifiers).
3. Dispatch each group, mark nodes settled or failed.
4. Repeat until no progress.

A failed dependency marks its dependents as `skipped` (not `failed`), so the
result collector can distinguish "lookup failed" from "could not run."

## FX Rate Batching

When converting prices for an array of identifiers to a specific output
currency (e.g. `price@USD`), the source currency of each symbol is only known
after its quote node settles. A single `FxRateBatchNode` is shared across the
entire graph:

- It takes all quote nodes in the batch as deps.
- After they settle, it extracts the unique source→output pairs.
- It fetches only those unique pairs in one call.
- It returns a `Record<sourceCurrency, rate>` table.

Each `CurrencyConversionNode` depends on its own quote node plus the shared
`FxRateBatchNode`, and looks up its rate by source currency. The graph remains
fully static — no dynamic expansion needed.

## Array Identifier Input

`RequestInput` carries an array of identifiers, all requesting the same
attribute (e.g. a column of tickers all wanting `price`). Each identifier gets
its own subgraph from `InputNode` through to `OutputValue`, all built from the
single `RequestInput`. Batching across identifiers happens at two points:

1. **Quote nodes** with the same executor id (e.g. all Yahoo equities) are
   grouped by the engine and dispatched in one `executeBatch` call.
2. **`FxRateBatchNode`** deduplicates FX pairs across the whole batch as
   described above.

## Relationship to Existing Resolver Classes

The migration proceeds in two stages.

**Stage 1 — wrap.** Each `RoutingNode` subclass wraps its corresponding leaf
resolver. It constructs the `RouteJob[]` the resolver needs, calls
`executeBatch`, and extracts the typed result. The leaf resolver classes are
unchanged.

```
RoutingNode subclass  ← new: typed inputs/outputs, graph wiring
    │
    ▼
Leaf resolver         ← existing: executeBatch, unchanged
```

**Stage 2 — dissolve.** Once the DAG is settled and the wrapping layer is
stable, the leaf resolver classes can be deconstructed. Their I/O logic moves
directly into the `RoutingNode` subclasses, eliminating the intermediate layer.
This is a cleanup step, not a behavior change.

## What This Replaces

| Current code | Replaced by |
| :--- | :--- |
| `resolveIdentifierPlanEnvelope` in `request-resolution.ts:146` | `YahooIsinSearchNode` + `PseIsinMapNode` |
| `buildAttributePlan` callback in `ResolvePlan` | quote node wired at graph-build time |
| `resolvePlannedQuoteEnvelope` in `request-resolution.ts:127` | quote node `execute` |
| `projectLookupValue` in `request-resolution.ts:193` | `CurrencyConversionNode` (only added when needed) |
| `resolveQuoteForResolvedRequest` in `quote-routing.ts:18` | `FirstSuccessNode` per exchange type |
| `executeRouteJobs` while-loop in `route-execution.ts:33` | topological engine |
| `ResolverPlan.getNodesForRequest` | graph builder wiring |
| `IdentifierResolutionPlan.getNodesForRequest` | `YahooIsinSearchNode` / `PseIsinMapNode` construction |
| `FxAttributeResolutionPlan.getNodesForRequest` | `LocalFxNode` vs `GoogleFxNode` branch in builder |

## Key Properties

**Node overrides.** The graph builder accepts override hints that replace
specific node subclasses. For example, a `@SOURCE` annotation on the request
can force FX resolution to `YahooFxNode` instead of `GoogleFxNode`. The
builder substitutes the override at wiring time; the engine and the rest of the
graph are unaffected.

**Conditional nodes.** `CurrencyConversionNode`, `FxRateBatchNode`,
`YahooIsinSearchNode`, and `PseIsinMapNode` are only added to the graph when
the request actually needs them. There is no runtime branching inside the
engine.

**Inspectability.** The full routing path for any request is a subgraph that
can be walked, printed, or compared against expected structure in tests — before
any I/O happens.

**Sync-compatible.** `execute` on each node can be synchronous. The engine
does not require `Promise`. Apps Script compatibility is preserved.

## FirstSuccessNode

Some routing steps need to try candidates in order and stop at the first
success. These are modeled with a `FirstSuccessNode` combinator.

Two places in the routing tree use this pattern:

| Location | Candidates (in order) |
| :--- | :--- |
| PSE equity quotes | `PSEFramesQuoteNode` → `PSEEdgeQuoteNode` |
| Non-PSE equity quotes | `YahooQuoteNode` → `TradingviewFundQuoteNode` |

`FirstSuccessNode` is a leaf from the engine's perspective: it has normal DAG
deps (data inputs) and a single output. Internally it holds an ordered
`candidates` list — resolver wrappers that are not DAG nodes themselves but
receive the same inputs as the `FirstSuccessNode`.

```
FirstSuccessNode
  deps:       [SymbolFastForwardNode]  ← normal DAG deps (identifier node)
  candidates: [PSEFramesQuoteNode,     ← ordered, inspectable
               PSEEdgeQuoteNode]
  execute(resolvedRequest):
    for each candidate in order:
      result = candidate.execute(resolvedRequest)
      trace.record(candidate, result)
      if success: return result
    return failure
```

**Why this is responsible:**

- The engine stays dumb — no special-casing for first-success semantics.
- Attempt order is explicit and inspectable on the node before any I/O.
- Every attempt outcome is recorded in the trace, not just the winner.
- Downstream nodes depend on `FirstSuccessNode`, correctly modeling "I need
  *a* PSE quote" rather than a specific strategy.
- Candidates cannot have deps that aren't already deps of their
  `FirstSuccessNode` — a clean, enforceable constraint.

**Rendering.** The DAG renderer expands `candidates` as if they were children,
using visual marking (dashed edges, a `⊕` label, or a bracketed group) to
distinguish first-success fan-out from normal deps. The graph reads as native
while the fallback semantics remain unambiguous.

## Resolved Design Decisions

- **RouteState.** Each `RoutingNode` subclass constructs `RouteJob[]` from its
  typed dep outputs and populates `routeState` at that boundary. No RouteState
  crosses resolver boundaries — all four shapes (`IsinIdentifierRouteState`,
  `FxQuoteRouteState`, `PseQuoteRouteState`, `EquityYahooQuoteRouteState`) are
  derived entirely from `RequestInput` or `ResolvedRequest`, both available as
  dep outputs. Intermediate state within a resolver (e.g. `listing` in PSE
  resolvers) stays inside `executeBatch` and is unaffected. No migration
  needed.
- **Caching.** Injected into `ExecutionEnv` rather than modeled as nodes.
