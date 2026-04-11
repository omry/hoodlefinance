---
status: Active
updated: 2026-04-11
summary: Current graph and ResolveFlow shape for the authored DAG runtime.
---

# Final DAG Shape Redesign

## Objective

This should be the last structural redesign of the authored DAG and the runtime
graph object.

The goal is to make the DAG architecture minimal and durable:

- the authored graph definition should stay very small
- the runtime should expose one graph object
- old structural leftovers from previous iterations should be removed
- tests and CLI should continue to work after migration

This redesign is about graph shape and object boundaries, not routing behavior.

## Historical Context

Earlier iterations of the TypeScript routing work carried multiple generations
of DAG design:

- authored graph data in `DagPlan`
- a separate public structural DAG layer
- a compiled runtime graph in `ResolveFlow`
- older tree-oriented and table introspection assumptions in parts of the CLI

That intermediate layering is the context for this document. The current
runtime shape described below is the result of removing those extra structural
layers and consolidating the graph model around `Graph` plus `ResolveFlow`.

## Design Direction

The final architecture should have two layers only:

1. Authored DAG data
2. Runtime `ResolveFlow`

The structural DAG should no longer exist as a separate public architecture
layer. Its responsibilities should be absorbed into `ResolveFlow`
construction.

## Final Authored DAG Shape

For this iteration, keep the authored definition minimal and close to the
current one:

```ts
namespace Graph {
  export interface Node {
    id: string;
    type: string;
    next?: string[];
  }

  export type Definition = Record<string, Node>;

  export interface View {
    definition: Definition;
    getNode(id: string): Node | null;
    getRoot(): Node | null;
    getTerminal(): Node | null;
    getChildren(id: string): Node[];
    getParents(id: string): Node[];
    getTopologicalOrder(): Node[];
  }
}
```

Constraints for this phase:

- keep concrete class-name strings in `type` for the initial migration
- do not introduce a central key-to-class compiler map beyond the existing
  composition/materialization path
- do not switch to semantic `kind` names yet
- do not redesign serialization yet

This keeps the redesign focused on graph shape, not on plugin or registration
architecture.

Current authored/runtime graph primitives should stay limited to what the
existing linear `ResolveFlow` runtime can execute honestly.

That means this phase may use simple unconditional sequencing primitives such
as `StepPlan`, but it should not pretend to support richer execution semantics
such as first-class fan-out or fan-in unless the runtime really implements
them.

Those richer primitives are still expected to become useful later. They belong
to the compiled execution-graph phase described in
[`execution-graph-compilation.md`](./execution-graph-compilation.md), where a
more capable engine can model branch, join, and transform behavior directly.

Additional invariants:

- `Graph.Node.id` must be unique
- each outer `Graph.Definition` key must match `Graph.Node.id` during this phase
- `next` entries are ids of downstream nodes
- omitted `next` means no outgoing edges
- if a root node exists, its id must be `ROOT`
- if a terminal node exists, its id must be `TERMINAL`

The data model does not store explicit `root` or `terminal` fields.
Those are derived properties of the graph, and helper functions may expose them
when they exist.

## Final Runtime Shape

`ResolveFlow` should be the single runtime graph object used by:

- routing compilation
- runtime lookup
- future graph rendering

It should store truth and compute projections.

That means:

- store the pure graph directly
- store instantiated runtime resolver nodes
- expose pure-graph helpers through the graph object
- do not expose resolver lookup publicly

It should not treat derived views such as `topologicalOrder` as core graph
identity.

Current shape:

```ts
class ResolveFlow {
  readonly graph: Graph.View;

  constructor(definition: Graph.Definition, deps);

  getGraph(): Graph.View;
  resolveAttribute(identifier: string, attribute?: string): unknown;
}
```

`resolveAttribute(identifier, attribute)` is the high-level runtime API exposed
by the current TypeScript graph runtime. It lives on `ResolveFlow` and mimics
`HOODLEFINANCE()` at the runtime boundary.

`getTopologicalOrder()` is a projection, not core state.
It is a dependency-respecting linearization of the DAG in which every parent
appears before its children. The current implementation uses Kahn's algorithm:

1. start from nodes with no parents
2. emit a node
3. decrement unresolved parent counts for its children
4. enqueue a child once all of its parents have been emitted

If not all nodes can be emitted, the graph contains a cycle.

This makes `ResolveFlow` the owner of:

- the pure graph
- instantiated node materialization
- the bridge between graph nodes and resolver instances

The instantiated resolver map may still exist internally, but it should not be
part of the public `ResolveFlow` surface.

## Removed Older Layers

The current runtime no longer uses these earlier public architectural layers:

- `PlanSpecDag`
- `HoodleFinancePlanSpecDag`
- `instantiatePlanSpecDag(...)`
- `instantiateHoodleFinancePlanSpecDag(...)`
- `hoodleFinanceDagStructureValidation(...)`
- `ResolveFlowSpecs`
- `collectResolveFlowPlanSpecs(...)`
- `collectResolveFlowResolverSpecs(...)`
- `deriveResolveFlowSpecs(...)`
- `compileResolveFlow(...)`
- `ResolveFlow.fromPlanSpecs(...)`

The older separation also removed construction scaffolding such as:

- `ResolveFlowOptions`
- `dag` as a nested field on `ResolveFlow`

## Runtime Behavior Requirements

This redesign must not change routing behavior.

It must preserve:

- current request classification at the DAG root
- identifier and attribute routing behavior
- current representative route strings
- terminal-node non-executability
- the high-level `resolveAttribute(identifier, attribute)` behavior

The migration does not need to preserve the current TypeScript pipeline support
for:

- tracing
- intermediate graph inspection
- source override plumbing
- other advanced introspection-oriented helper surfaces

Those can be removed from the TypeScript pipeline for now and added back later
on top of the redesigned graph shape.

This distinction is specifically about debugging and introspection facilities.
It does not relax the requirement to preserve user-facing `HOODLEFINANCE`
behavior.

## CLI And Rendering Implications

The CLI should continue to support the high-level lookup path and smoke
verification during and after the redesign.

This redesign does not implement the new graph renderer.
It should leave the runtime in a shape where rendering can read directly from
`ResolveFlow` through `resolveFlow.getGraph()`, without needing a separate
structural DAG object or any resolver-materialization helpers.

The existing `ResolveFlow` rendering design should be interpreted against the
final runtime shape, not the current transitional one.

Existing CLI behavior that exists primarily for tracing or graph inspection is
not part of the migration contract in this step and may be removed from the
TypeScript pipeline for now.

Those debugging-oriented facilities should only be reintroduced after the final
graph structure is in place, including the compiled DAG phase
(`ResolverPlan` -> concrete DAG).

Out of scope for this migration:

- implementing the first renderer against the redesigned graph
- reintroducing tracing or graph-inspection facilities
- adding post-migration visualization tooling

The first follow-up after this migration should be rendering against the new
graph shape.

That follow-up should obey these constraints:

- visualization must consume only `Graph.View` data obtained from
  `resolveFlow.getGraph()`
- visualization must not depend on `ResolveFlow` internals such as
  `getNodeByCode(...)`, `getPlanNodeByCode(...)`, `nodesByCode`, or compiled
  resolver instances
- the first graph-rendering format should be Mermaid text
- the first integration target should be `cli --graph`
- the initial CLI experience should remain text-based by rendering Mermaid
  through a Mermaid-to-ASCII tool
- if graph-rendering configuration is needed for the CLI path, keep it local to
  the CLI entrypoint and define it near the top of the CLI source rather than
  spreading rendering constants into core runtime code

## Validation Requirements

All current structural validation must still exist after the redesign, but it
should become part of `ResolveFlow` construction rather than a separate public
layer.

That includes:

- duplicate normalized code rejection
- missing child rejection
- cycle rejection
- exactly one root
- exactly one terminal
- reachability from root
- reachability to terminal
- stable topological order

## Migration Plan

1. Move structural DAG node and edge construction into `ResolveFlow`
   construction.
2. Move root/terminal validation into the `ResolveFlow` constructor.
3. Make `ResolveFlow` store the pure graph plus internal instantiated resolver
   state, and expose graph helpers through `Graph.View`.
4. Update tests to assert against `ResolveFlow` instead of separate DAG helper
   APIs.
5. Update CLI/runtime callers that still depend on the old split.
6. Remove the public helper layers that are no longer necessary.

This migration stops after the structural replacement is complete and the old
shape is removed. Rendering is the immediate next step, but it is not part of
the acceptance criteria for this migration.

## Test Expectations

After migration:

- all current route-planning tests should still pass
- all current integrated routing tests should still pass
- CLI smoke behavior should still pass
- the high-level attribute-resolution path should remain verified end-to-end
- structural validation tests should be rewritten around `ResolveFlow`
  construction instead of separate DAG helper entrypoints
- tests that exist primarily for TypeScript tracing, graph inspection, source
  override plumbing, or similar TS-only helper surfaces may be removed as part
  of this migration
- tests should only be rewritten when they directly inspect graph-related
  structures or graph-helper APIs
- higher-level tests covering user-facing `HOODLEFINANCE` behavior should
  remain unchanged unless the redesign exposes a real bug
- if a higher-level test fails because of the redesign, pause and ask for
  direction before changing behavior or rewriting that test
- any test that currently inspects `resolveFlow.dag.*` should inspect
  `resolveFlow.getGraph()` and `Graph.View` helper methods instead

## Open Constraints

These are intentionally deferred:

- replacing `type` class-name strings with a registration model
- removing `runtimeRefs`
- changing `DagPlan` naming
- changing routing semantics

Those may happen later, but they are not part of this redesign.

## Follow-Up On Initial Implementation

The first implementation of this redesign may still leave transitional gaps
even after the old structural DAG layer is removed.

One follow-up item remains after the initial migration:

1. Runtime coupling to specific resolver ids and node types
   - Structural awareness of the graph `ROOT` and `TERMINAL` boundaries remains
     in scope for `ResolveFlow`, via graph helpers such as
     `resolveFlow.getGraph().getRoot()` and `resolveFlow.getGraph().getTerminal()`.
   - Any hard-coded awareness beyond those structural boundaries remains a gap.
   - The remaining examples are HOODLEFINANCE-specific authored ids such as
     `RESOLVED-IDENTIFIER` and `DEFAULT-ATTRIBUTE:FX`, plus specific node-type
     strings such as `TerminalCollectorPlan`.
   - That means the runtime still mixes generic graph ownership with
     application-specific bootstrap knowledge.
   - In the short term, smaller local cleanups may still be possible.
   - The clean fix, however, is now mostly blocked on the compiled execution
     DAG phase (`ResolverPlan` -> execution DAG).
   - The reason is that the remaining authored-id coupling is currently filling
     in for missing graph-native handoff semantics between:
     - request classification
     - identifier resolution
     - downstream attribute routing
   - Fully removing this coupling is therefore expected to wait for the DAG
     compiler / execution-lowering step.

The goal of this follow-up is not to redesign routing semantics.
It is to finish collapsing the remaining compatibility scaffolding after the
structural migration is proven stable.
