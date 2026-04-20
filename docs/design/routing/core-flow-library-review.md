---
status: Draft
updated: 2026-04-20
summary: Code review of core/flow as a general-purpose graph execution library
---

# `core/flow` Library Review

## Summary

A review of `src/core/flow` treating it as a general-purpose graph execution library. The
execution core — graph traversal, envelope passing, routing kinds — is solid. The main issues
are naming confusion around identifiers and method pairs, internal engine state leaking
through public types, dead initialization hooks, hardcoded ROOT/TERMINAL, and a base class
that carries dead display methods.

`ResolveFlow` is also an applicative name. Rename to **`Flow`**: the graph is the graph
definition; `Flow` is an instantiated, runnable graph; `FlowEngine` runs it. An `AsyncEngine`
could run it asynchronously later. This keeps the vocabulary clean and non-domain-specific.

---

## Naming and Identity Confusion

### Three names for one thing

`Graph.Node` has `id`; `Resolver` has both `code` and `name`; all three hold the same
normalized value in practice. A consumer cannot tell which to use. Converge on `id`: remove
`code` and `name` from `Resolver` and use `id` throughout.

### `Resolver` → `FlowNode`; `resolve()` / `execute()` → `execute()` / `run()`

"Resolver" implies financial resolution — it is not a meaningful name for a class that
implements graph node logic. Rename to **`FlowNode`** — it maps to the library's own name
and is non-domain-specific. (`GraphNode` collides with `Graph.Node`; `Handler` and
`Processor` are too generic; `Step` conflicts with `StepPlan`.)

Rename the method pair: the public timing/error-wrapping entrypoint from `resolve()` to
`execute()`, and the override point from `execute()` to `run()`. Callers invoke `execute()`;
subclasses override `run()`. The current pair reads as synonyms.

### `ResolverPlan` → `FlowJunction`; drop "Plan" from subclasses

"Plan" communicates nothing about selection semantics. Rename the base class to
**`FlowJunction`** — a junction is a point where paths branch or merge, following the `FlowX`
naming pattern.

Concrete subclasses drop "Plan": `SwitchJunction`, `StepJunction`, `FirstSuccessJunction`
(or shorter: `SwitchNode`, `StepNode`, `FallbackNode`).

### Is the Leaf / Junction distinction necessary?

The `RoutingNodeKind.Leaf` case is underspecified: "leaf" nodes can still have children (the
engine tries each in order), and since the graph enforces a terminal node, every non-terminal
node already has at least one successor. Meanwhile junctions can do processing and output
transformation too.

This raises whether Leaf should be removed in favor of treating all nodes as Step-like. If so,
`RoutingNodeKind` collapses to `Switch | Step | TryEach`, the `selectNext()` / `canHandle()`
dual path disappears, and the engine simplifies significantly. Worth deciding before
stabilizing the API.

### `RoutingNodeKind.TryEach = "try each"` — space in the string value

String enum values with spaces break serialization/deserialization silently.
Change to `"try_each"`.

---

## Leaky Internal State

### `Envelope` carries internal engine bookkeeping

`didReachStopNode` is a bounded-execution control flag used by `executeBounded()` internally.
It should not be visible to callers. Fix: make the field private or prefix it with `_` to
signal it is not part of the public contract.

### `EnvelopeStatus.TerminalFailure` on the public result

Whether a failure is terminal is an engine-internal concern (TryEach exhaustion). The public
envelope status should be `success | failure` only. When TryEach exhausts all options, the
engine can encode the detail in the error string — e.g.
`"exhausted all options in node X [Y1, Y2, Y3]"` — rather than a separate status value.

---

## Implicit Interfaces vs. Explicit Ones

### `selectNext()` throws on the base class

`Resolver.selectNext()` always throws; the engine must guard with `getRoutingNodeKind()`
before calling it. This is related to the Leaf → Step conversion question above: if all nodes
become step-like, this issue dissolves. If the distinction is kept, express the routing
capability structurally via a `RoutingNode` interface that `FlowJunction` implements, so the
engine can type-narrow rather than runtime-check.

### `canHandle()` dual null-check

`FlowEngine.#childCanHandle()` does `!childResolver?.canHandle || childResolver.canHandle(value)`.
Since `canHandle` is always on `Resolver`, the `?.` guard is only reached when the resolver
is null — the expression checks two unrelated things. Simplify to a null check followed by a
plain `canHandle()` call.

---

## Dead Initialization Hook

`initEnv(_env)` should be treated as dead code: environment is now passed via the context
object to `execute()`. Remove `initEnv` from `FlowNode`, from the `Flow` instantiation
loop, and from any concrete `FlowNode` subclasses that override it.

---

## Hardcoded Topology Conventions

`ROOT` and `TERMINAL` are required node IDs enforced in `requireSingleBoundaryNode()`. Make
them configurable via an optional config object in the `ResolveFlow` constructor, e.g.:

```ts
new ResolveFlow(definition, registry, { entryNodeId: "ROOT", exitNodeId: "TERMINAL" })
```

Defaulting to `ROOT` / `TERMINAL` preserves backwards compatibility while letting callers
override.

---

## Responsibility Overload on `FlowNode`

The base class carries dead-weight display/introspection methods with no bearing on
execution:

- `getExampleInput()`
- `getRoutingDescription()`
- `describeRoutingNode()`
- `getGroupedSourceNames()`
- `getGroupedSourceNamesForDisplay()`
- `describe()`
- `buildRoutePath()` (on `FlowJunction`)

Remove them now. Re-introduce whichever ones are needed later, properly separated from the
execution protocol. `describePlanSource` (a formatting helper in `resolver.ts`) goes with
them.

---

## `Graph.Definition`: data schema vs. runtime definition

The current `Graph.Definition` type conflates two things: the static graph schema (declared
in TypeScript today, intended for JSON later) and the normalized runtime representation. The
index signature widened to admit `SubgraphRegistry` as a value type makes this worse.

These should be two separate concepts: a raw input schema (loose types, validated on load)
and an internal normalized form (strict, typed, trusted). The `__subgraphs__` special-casing
that already exists throughout the code is a symptom of this conflation.

---

## Inconsistent API Surface on `FlowJunction`

`getNodesForRequest` and `getHandleableNodesForRequest` have subtly different semantics
("start from first match" vs "filter all"), which `StepPlan` further overrides to ignore
`canHandle` entirely. The API surface should be consistent: one method, one contract. Decide
what the right abstraction is (likely just `getHandleableNodes(request)`) and remove the
rest.

---

## Pending Code Changes

Concrete changes resulting from this review, to be tracked for implementation:

**Renames**
- ~~`ResolveFlow` → `Flow`~~
- ~~`Resolver` → `FlowNode`~~
- ~~`ResolverPlan` → `FlowJunction`; `SwitchPlan` → `SwitchJunction`, `StepPlan` → `StepJunction`, `FirstSuccessPlan` → `FirstSuccessJunction` (or shorter functional names)~~
- ~~`Resolver.resolve()` → `FlowNode.execute()`; `Resolver.execute()` → `FlowNode.run()`~~
- ~~`RoutingNodeKind.TryEach` string value: `"try each"` → `"try_each"`~~
- ~~`RoutingNodeKind` → `NodeKind`; `getRoutingNodeKind()` → `getNodeKind()`~~
- ~~`resolve-flow.ts` → `flow.ts`~~ (partial); remaining: `resolver.ts`, `core-resolvers.ts` filenames; `getResolver()` method on `Flow`; `resolverEnv` parameter (goes away with `initEnv` removal)

**Identifier cleanup**
- ~~Remove `code` and `name` from `FlowNode`; use `id` throughout~~

**Dead code removal**
- Delete `initEnv()` from `FlowNode`, the instantiation loop in `Flow`, and any concrete subclasses that override it
- ~~Delete display/introspection methods from `FlowNode` and `FlowJunction`:
  `getExampleInput`, `getRoutingDescription`, `describeRoutingNode`, `getGroupedSourceNames`,
  `getGroupedSourceNamesForDisplay`, `describe`, `buildRoutePath`, `describePlanSource`~~
- ~~Delete `normalizeCode` in `resolve-flow.ts` and `normalizeNodeCode` in `core-resolvers.ts`~~
- ~~Delete `src/core/routing-introspection.ts`: dead code in the TS layer — the legacy JS runtime
  has its own parallel implementation; no production TS consumer exists~~

**Engine fixes**
- ~~`FlowEngine.#childCanHandle()`: replace the compound optional-chain expression with a
  plain null check followed by a `canHandle()` call~~
- ~~`EnvelopeStatus.TerminalFailure`: remove from the public `Envelope` status union; encode
  TryEach exhaustion as an error string (`"exhausted all options in node X [Y1, Y2, Y3]"`)~~
- ~~`Envelope._didReachStopNode`: remove from the `Envelope` interface entirely; `Envelope` is user-facing so internal engine bookkeeping must not appear on it. Move the flag to a separate internal envelope type used only within the engine.~~

**API surface**
- `FlowJunction.getNodesForRequest` / `getHandleableNodesForRequest`: collapse to one method
- ~~`Flow` constructor: accept optional `{ entryNodeId, exitNodeId }` config (defaults to
  `ROOT` / `TERMINAL`)~~
- Decide on Leaf → Step conversion (see Leaf / Junction section above); implement if agreed
- Consider a multi-output switch: today `SwitchJunction` throws if `selectNext()` returns more than one child. A node-level flag (e.g. `fanOut: true`) could allow a switch to select multiple children and fan execution out to all of them. Worth evaluating once the Leaf → Step question is settled.

**Graph types**
- Separate `Graph.Definition` (raw input schema) from the normalized internal representation

**Tracing**
- When the main `ExecutionTrace` is fully implemented, unify the trace shape: extract a `CallTrace`
  base type (`path`, `route`, `status`, `error?`) and extend it with `subgraphId` for
  `SubgraphCallTrace`, so both the top-level and subgraph traces share the same structure

**Remaining Work**

Tracing infrastructure exists but is not fully wired. `ExecutionContext.callSubgraph` has no
trace parameter, so subgraph calls from within a node's `run()` create an isolated trace that
is silently discarded. Other gaps: partial path capture, no timing on junction nodes. Treat
tracing as a known incomplete feature — do not rely on it in production paths until it is
fully wired.
