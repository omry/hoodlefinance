---
status: Draft
updated: 2026-04-16
summary: Add first-class subgraph call support so reusable graph fragments can be invoked without mid-graph entry hacks or graph duplication.
---

# Subgraph Call Support

## Summary

Add a first-class subgraph call primitive to the graph runtime so reusable graph
fragments can be invoked by name with explicit input and output boundaries.

This should be delivered as independent infrastructure work with its own test
coverage before any existing runtime caller is migrated to use it.

The proposed design introduces a reusable subgraph definition plus a call
surface that can invoke that subgraph without copying its internal nodes into
multiple caller branches.

## Problem

The current runtime has no first-class way to express reusable graph fragments.

Today reuse is effectively modeled as an implementation-detail jump into a
specific authored node id and then back out through implicit runtime behavior.

That shape has several problems:

- reuse depends on authored node ids rather than on an explicit graph contract
- callers must know where the reusable behavior starts and ends
- the runtime treats reuse as a disguised mid-graph jump
- tracing and future batching cannot distinguish normal graph flow from an
  internal subgraph invocation
- changing the internal FX branch shape risks breaking callers that are coupled
  to specific node ids

## Goals

- Make reusable graph fragments callable by name rather than by arbitrary node
  id.
- Keep the subgraph boundary explicit: callers provide input, callees return
  output, internal nodes stay encapsulated.
- Make Mermaid graph rendering able to represent subgraph call semantics
  without flattening them back into an indistinguishable mid-graph jump.
- Land subgraph-call support as a standalone runtime capability with tests,
  without requiring immediate migration of existing callers.
- Keep future batching viable by making repeated reusable work visible as the
  same runtime operation.

## Non-Goals

- Redesign the entire authored DAG format in one pass.
- Introduce full graph functions, recursion, or arbitrary nested graph
  composition immediately.
- Solve all future batching requirements in this document.
- Make arbitrary `executeFromNodeId(...)` jumps a permanent public primitive.
- Replace all existing runtime refs at once.
- Migrate existing production call sites in the same change that introduces
  subgraph-call support.

## Proposed Design

### Design Direction

The runtime should model reuse as a named subgraph invocation, not as a jump to
an authored node id.

The conceptual call shape is:

```text
caller value
  -> adapt to subgraph input
  -> invoke named subgraph
  -> adapt subgraph output back to caller value
```

The reusable thing is the subgraph definition, not a specific live node
instance.

### New Primitive: Subgraph Call

Add a runtime primitive with the following semantics:

- the caller references a named subgraph
- the subgraph has one declared root node and one declared terminal node
- the caller provides explicit input to the subgraph
- the subgraph runs in its own invocation context
- the caller receives an explicit result value back

The key point is that the caller does not name internal authored nodes
directly.

### Subgraph Definition Shape

The exact type can stay minimal in the standalone support pass. A reasonable shape is:

```ts
interface GraphSubgraph {
  id: string;
  rootNodeId: string;
  terminalNodeId: string;
}
```

When a production caller is later migrated, the runtime can point these
boundaries at nodes that already exist in the authored DAG. This keeps the
first caller migration small while making the call-site contract explicit.

The standalone support work should also validate that the declared root and
terminal nodes are structurally connected. A subgraph declaration is invalid if
the terminal node is not reachable from the root node.

Longer term, the runtime may choose to let subgraphs own dedicated node sets or
to compile a subgraph registry from a richer authored definition.

### Runtime Surface

The standalone support work adds this new reusable primitive:

```ts
interface SubgraphCallInput {
  subgraphId: string;
  input: object;
}

interface PlanRuntimeRefs {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}
```

Existing compatibility refs can adopt this primitive later in separate
migration work.

### ResolveFlow Ownership

`ResolveFlow` should own the mapping from subgraph id to runtime call boundary.

Initial shape:

```ts
interface ResolveFlowSubgraphRegistry {
  [subgraphId: string]: {
    rootNodeId: string;
    terminalNodeId: string;
  };
}
```

`ResolveFlow` then exposes a helper conceptually like:

```ts
callSubgraph(subgraphId: string, input: object): LookupResult
```

That helper is responsible for:

- resolving the named subgraph
- executing from the subgraph's declared root node
- stopping at the subgraph's declared terminal node
- returning a result in the same success/failure envelope style as other
  runtime refs

### FlowEngine Role

The initial standalone support phase does not require a large `FlowEngine` redesign.

Short-term approach:

- keep the existing execution engine
- implement `ResolveFlow.callSubgraph(...)` as a runtime wrapper
- continue using `executeFromNodeId(...)` internally only as an implementation
  detail

Longer-term direction:

- give `FlowEngine` explicit subgraph invocation support rather than raw
  mid-graph entry as the main reuse primitive
- add structured nested tracing for subgraph calls
- make batching and scheduling aware of subgraph invocation boundaries

This staged approach keeps the first implementation small while moving the
architecture toward a principled engine primitive.

### Mermaid And Rendering Semantics

The graph visualization must be able to represent subgraph call semantics.

This matters for two reasons:

- the current Mermaid output is the canonical visualization format for the
  TypeScript CLI and docs
- if subgraph calls are not representable in Mermaid, the rendered graph will
  continue to hide the distinction between a named reusable call and an
  implementation-detail jump into an internal node id

The rendering requirement is therefore part of the design, not a later
documentation nicety.

The renderer should make these semantics visible:

- a caller invokes a named subgraph
- the callee is a reusable graph fragment with its own explicit boundary
- the call edge is distinct from ordinary in-graph dataflow edges

In the standalone support pass, Mermaid does not need to render nested execution traces or
runtime call stacks. It only needs to show that a node is a subgraph call and
which named subgraph it targets.

The design should preserve compatibility with the current rendering model in
[`resolve-flow-rendering.md`](./resolve-flow-rendering.md): Mermaid remains the
canonical render format, and rendering still prefers stable topology-oriented
output over request-specific runtime detail.

Two acceptable initial Mermaid strategies are:

1. A call node plus a labeled edge to a named subgraph boundary.
2. A call node labeled with the target subgraph id, while the reusable
   subgraph body is rendered separately in the same Mermaid document.

The first strategy would look conceptually like:

```mermaid
flowchart LR
  CALLER["NORMALIZE:PRICE"]
  CALLSUB["CALL<br/>SOME_SUBGRAPH"]
  SUBIN["SOME_SUBGRAPH<br/>ROOT"]
  SUBOUT["SOME_SUBGRAPH<br/>TERMINAL"]

  CALLER --> CALLSUB
  CALLSUB -. call .-> SUBIN
  SUBOUT -. return .-> CALLER
```

The exact Mermaid syntax does not need to be finalized in this design note.
What matters is the semantic requirement:

- ordinary `next` edges and subgraph-call edges must be distinguishable in the
  rendered graph
- the rendered graph must show named subgraph boundaries rather than only the
  implementation nodes inside them

This requirement implies that the renderer will likely need some subgraph-aware
metadata in addition to the current plain `Graph.Node.next` topology. That does
not require redesigning `Graph.View` immediately, but it should be treated as a
first-class output requirement for the subgraph-call feature.

### Independent Delivery Requirement

Subgraph-call support should be introduced as independent infrastructure.

That means the first implementation should:

- add the runtime primitive
- add the rendering support
- add dedicated tests
- leave the current FX compatibility path in place

Only after that groundwork is merged should the current FX compatibility hook
be ported to the new primitive.

This keeps the new abstraction reviewable on its own and avoids conflating two
different questions:

- whether subgraph-call support is a sound runtime primitive
- whether the first production migration onto that primitive is the right one

## Interfaces And Invariants

### Interfaces

Standalone support additions:

```ts
interface PlanRuntimeRefs {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}

interface GraphSubgraph {
  id: string;
  rootNodeId: string;
  terminalNodeId: string;
}
```

Potential future node/config surface:

```ts
interface SubgraphCallSpec {
  subgraphId: string;
  inputAdapterRef?: string;
  outputAdapterRef?: string;
}
```

### Invariants

- callers must not reference internal authored node ids of reusable graph
  fragments directly
- each named subgraph must declare exactly one root node and one terminal node
- each named subgraph must be connected, with the terminal node reachable from
  the root node
- subgraph invocation must preserve the current success/failure envelope model
- Mermaid rendering must be able to distinguish a subgraph call from an
  ordinary graph edge
- a subgraph call must not mutate the caller's routing context implicitly
  without an explicit adapter contract
- `executeFromNodeId(...)` may remain as an internal compatibility tool, but it
  should stop being the conceptual reuse primitive

## Rollout And Operations

### Phase 1: Introduce Named Subgraph Calls As Standalone Infrastructure

- add a subgraph registry owned by `ResolveFlow`
- add `callSubgraph(...)` to runtime refs
- add Mermaid/rendering support for subgraph-call semantics
- add tests that validate the new primitive without changing existing call
  sites

Phase 1 intentionally does not migrate existing production call sites.

### Phase 2: Promote Subgraph Calls To An Engine Concept

- add structured subgraph invocation support to `FlowEngine`
- make traces show nested subgraph calls explicitly
- evaluate batching and caching behavior at the subgraph boundary

## Test Plan

- unit test that a named subgraph can be registered and invoked through
  `ResolveFlow.callSubgraph(...)`
- unit test that unknown subgraph ids fail with a clear error
- unit test that subgraph registration fails when the declared terminal node is
  unreachable from the declared root node
- renderer test that Mermaid output shows subgraph-call edges or call nodes in
  a way that is distinguishable from ordinary `next` edges
- trace test that a subgraph invocation records a distinct call boundary once
  tracing support is added

## Open Questions

- Should the first subgraph contract return a bare numeric rate or a structured
  conversion result object?
- Should subgraph definitions stay as a runtime registry only, or should the
  authored graph format eventually grow first-class subgraph declarations?
- Should input/output adapters be explicit spec objects, or should the first
  pass keep adaptation logic in code?
- What is the minimal rendering metadata needed so Mermaid can show call
  semantics without forcing a full graph-model redesign first?
- When batching is added, should batching attach to repeated subgraph calls or
  to provider leaf nodes underneath the subgraph?