---
status: Active
updated: 2026-04-11
summary: Model the routing graph around authored DAG data plus a ResolveFlow runtime that exposes Graph.View as the public graph surface.
---

# ADR: ResolveFlow And Graph.View Runtime Shape

## Context

Earlier iterations of the TypeScript routing work carried extra structural DAG
layers and compilation scaffolding between authored graph data and the runtime
lookup object. That made the graph model harder to reason about and forced CLI
and rendering work to understand transitional internal shapes.

The current runtime and tests now center on `ResolveFlow`, `Graph.View`, and a
minimal authored graph definition.

## Decision

Use a two-layer graph model:

1. authored DAG data
2. a `ResolveFlow` runtime that exposes `Graph.View`

Do not keep a separate public structural DAG layer.

`ResolveFlow` is the runtime boundary for lookup, while `Graph.View` is the
public graph surface used for inspection and rendering. Rendering and CLI graph
output should consume `resolveFlow.getGraph()` rather than internal resolver
materialization details.

## Consequences

- The runtime graph model is smaller and easier to keep stable.
- CLI rendering and graph tooling build on `Graph.View` instead of transitional
  compiler artifacts.
- Older structural DAG concepts remain historical only and should not be
  reintroduced casually.
- More detailed introspection can still be added later, but it should layer on
  top of `ResolveFlow` and `Graph.View` rather than creating a new public graph
  model.

## Related Docs

- [`../design/routing/final-dag-shape-redesign.md`](../design/routing/final-dag-shape-redesign.md)
- [`../design/routing/resolve-flow-rendering.md`](../design/routing/resolve-flow-rendering.md)
- [`../../src/core/resolve-flow.ts`](../../src/core/resolve-flow.ts)
