---
status: Superseded
updated: 2026-04-11
summary: Earlier structural DAG instantiation plan superseded by the final ResolveFlow graph shape.
superseded_by: docs/design/routing/final-dag-shape-redesign.md
---

> Superseded note: this document describes an earlier structural DAG-instantiation path. For the current graph/runtime shape, see [`final-dag-shape-redesign.md`](./final-dag-shape-redesign.md).

# PlanSpec DAG Instantiation Plan

## Objective

Add a new, separate graph-instantiation path that:

- takes `Record<string, PlanSpec>`
- returns a static instantiated DAG object
- leaves HOODLEFINANCE-specific root/terminal validation to a separate validator
- provides a top-level HOODLEFINANCE helper that performs both steps together
- does not change routing-graph execution logic in this step

## Current Constraints

- Production routing now compiles directly from `DagPlan` into the current legacy executor model.
- `DagPlan` is now the authored routing definition and also the input to the current legacy-executor compiler.
- The existing `RoutingGraph` type is execution-oriented and should remain unchanged for now.
- Existing plan interpretation derives children from ordered `nodeCodes`, including small fallback subgraphs such as the ISIN identifier route.

## Design Direction

Introduce a structural DAG-instantiation module alongside the runtime compiler.

The new module should:

- define a structural DAG type distinct from the runtime `RoutingGraph`
- instantiate nodes and edges from `Record<string, PlanSpec>`
- normalize codes consistently
- derive edges from `nodeCodes`
- validate generic graph correctness at instantiation time
- enforce HOODLEFINANCE routing-graph structure in a separate validator
- expose a one-shot HOODLEFINANCE entrypoint for callers that want the system-specific contract
- avoid coupling the structural DAG instantiator itself to runtime materialization behavior

## Proposed DAG Object

The instantiated DAG should contain:

- `nodesByCode`: normalized node lookup
- `nodes`: stable list of instantiated DAG nodes
- `edges`: explicit parent/child relationships
- optional topological order for inspection and testing

The HOODLEFINANCE-specific validator should additionally return:

- `root`: the single root node
- `terminal`: the single terminal node

The intended top-level HOODLEFINANCE API should instantiate and validate in one call.

Each DAG node should contain at least:

- `code`
- `spec`
- `parentCodes`
- `childCodes`

## Validation Rules

The generic instantiation function should reject:

- duplicate normalized codes
- missing referenced child nodes
- cycles

The HOODLEFINANCE-specific validator should reject:

- zero roots
- multiple roots
- zero terminal nodes
- multiple terminal nodes
- disconnected nodes
- nodes unreachable from the root
- nodes that cannot reach the terminal

"Connected" should mean:

- every node is reachable from the root, and
- every node can reach the terminal

## DagPlan Requirements

Evolve `DagPlan` into a closed-world static DAG definition consumed by the runtime compiler and the structural instantiator.
That means:

- every referenced node must be present in the table
- the DAG must include a real terminal collector node
- the graph must validate successfully as a single-root, single-terminal DAG

## Implementation Steps

1. Add a new core module for static DAG instantiation.
2. Define structural DAG types separate from runtime graph types.
3. Implement child-edge extraction from `nodeCodes`.
4. Build instantiated nodes and parent/child links from `Record<string, PlanSpec>`.
5. Add validation for uniqueness, closure, acyclicity, root count, terminal count, and connectivity.
   Split the generic structural checks from the HOODLEFINANCE-specific structure validator.
6. Export the new API from the core index.
7. Update `DagPlan` so it is a valid closed-world DAG with a real terminal collector node.
8. Add dedicated tests for successful instantiation and all validation failures.
9. Leave routing-graph execution untouched while allowing the current runtime to compile from `DagPlan`.

## Verification Criteria

- The new function accepts `Record<string, PlanSpec>` and returns a structural DAG object.
- The top-level HOODLEFINANCE helper accepts `Record<string, PlanSpec>` and returns a validated HOODLEFINANCE DAG.
- Existing runtime routing behavior remains unchanged from a caller perspective.
- `DagPlan` can be instantiated successfully and pass HOODLEFINANCE structure validation.
- Generic instantiation fails for missing references and cycles.
- HOODLEFINANCE structure validation fails for multiple roots, multiple terminal nodes, and disconnected nodes.
- The validated HOODLEFINANCE DAG has exactly one root and exactly one terminal node.
- Every node lies on a path from the root to the terminal.

## TODO

- Delete the remaining legacy execution spec derivation once the old executor compatibility tests stop needing it.

## Non-Goals

This change does not:

- replace the old runtime executor in this step
- replace `buildRoutingGraph(...)`
- change `RoutingGraph`
- change existing resolver classes in this step
- change current caller-visible runtime behavior
