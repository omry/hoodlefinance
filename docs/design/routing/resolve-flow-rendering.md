# ResolveFlow Rendering Design

## Objective

Replace the current tree-style routing introspection with a graph-native
rendering path that treats `ResolveFlow` as the primary runtime object.

This design is for CLI and documentation tooling only. It does not change
lookup behavior, resolver execution, or deployed runtime logic.

## Current Problem

The current `--routing` view renders routing as a nested tree.

That is misleading for two reasons:

- the authored routing definition is a DAG, not a tree
- the instantiated runtime object is now a whole-graph `ResolveFlow`, not a
  single root node with tree ownership semantics

The tree view is therefore only a lossy projection. It duplicates shared
children conceptually and makes sequential flow look like parent/child
containment.

## Design Direction

The new rendering path should render the whole `ResolveFlow`.

That means:

- topology comes from `resolveFlow.dag`
- runtime node metadata comes from instantiated resolver nodes
- renderers consume an explicit node-and-edge model
- tree projection is no longer the primary representation

The CLI should eventually expose this as `--dag`, replacing `--routing`.

## Source Of Truth

The renderer should build from two layers of `ResolveFlow`:

1. Structural topology
   - `resolveFlow.dag.nodes`
   - `resolveFlow.dag.edges`
   - `resolveFlow.dag.topologicalOrder`
   - `resolveFlow.dag.root`
   - `resolveFlow.dag.terminal`

2. Instantiated node metadata
   - `resolveFlow.getNodeByCode(code)`
   - `resolveFlow.getPlanNodeByCode(code)` when the node is a plan node
   - `getRoutingNodeKind()`
   - `getRoutingDescription()`
   - `describeRoutingNode()` when helpful for leaf labels

The structural DAG remains the topology source of truth. Instantiated nodes
only enrich that structure with display metadata.

## Intermediate Rendering Model

Introduce a small graph-view model dedicated to rendering.

Suggested shape:

```ts
interface ResolveFlowRenderNode {
  code: string;
  kind: string;
  label: string;
  description: string | null;
  parentCodes: string[];
  childCodes: string[];
}

interface ResolveFlowRenderEdge {
  from: string;
  to: string;
}

interface ResolveFlowRenderGraph {
  rootCode: string;
  terminalCode: string;
  nodes: ResolveFlowRenderNode[];
  edges: ResolveFlowRenderEdge[];
}
```

Properties:

- `nodes` must be stable and preferably follow DAG topological order
- `edges` must be explicit, not inferred from nested children
- each graph node appears exactly once
- shared downstream nodes remain shared in the rendering model

## Renderer Outputs

### Plain Text CLI View

The default CLI renderer should be terminal-first and graph-aware.

Recommended format:

```text
ROOT [switch] -> CLASSIFY-REQUEST, REQUEST-ROOT
CLASSIFY-REQUEST [leaf] -> TERMINAL
REQUEST-ROOT [switch] -> DEFAULT-ATTRIBUTE, IDENTIFIER-ROOT
QUOTE:TICKER [try each] -> YAHOO, TRADINGVIEW-FUND
YAHOO [leaf] - Yahoo quote lookup -> TERMINAL
```

Rules:

- one line per node
- each node appears once
- outgoing edges are explicit
- descriptions are optional and only shown when they add signal
- ordering follows the DAG topological order for stable diffs and test output

This output is intentionally not ASCII art. The goal is clarity, not a fake
tree diagram.

### Mermaid Output

Add a Mermaid renderer for GitHub and docs copy/paste.

Recommended direction:

```text
flowchart TD
  ROOT["ROOT [switch]"]
  CLASSIFY_REQUEST["CLASSIFY-REQUEST [leaf]"]
  REQUEST_ROOT["REQUEST-ROOT [switch]"]
  ROOT --> CLASSIFY_REQUEST
  ROOT --> REQUEST_ROOT
```

Rules:

- node ids should be Mermaid-safe
- human labels should preserve original routing codes
- topology must match the same intermediate graph used by the CLI renderer

## CLI Contract

The intended CLI shape is:

- `--dag`
  - default plain-text graph rendering
- `--dag --format mermaid`
  - Mermaid output from the same graph model

`--graph` remains reserved for request execution through the graph runtime.

`--routing` should be removed once `--dag` is complete.

## Non-Goals

This rendering change does not:

- redesign `ResolveFlow`
- change resolver classes
- change `DagPlan` naming or serialization format
- add request-specific route-path rendering in this step
- replace execution-oriented `RoutingGraph`

Request-specific planning and tracing can be added later as a separate
rendering layer on top of `ResolveFlow`.

## Verification Criteria

- the rendering model preserves the `ResolveFlow` DAG topology exactly
- shared nodes are rendered once, not duplicated into multiple subtrees
- node kind metadata is preserved in the rendered output
- plain-text output is stable across runs
- Mermaid output is derived from the same intermediate model
- the final CLI output no longer depends on tree recursion from a root node
