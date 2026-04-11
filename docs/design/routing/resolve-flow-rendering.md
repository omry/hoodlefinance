---
status: Active
updated: 2026-04-11
summary: Current graph-rendering shape for the TypeScript CLI based on Graph.View and `--graph`.
---

# ResolveFlow Rendering Design

This note describes the current graph-rendering path for CLI and documentation tooling.

It is rendering-only. It does not change lookup behavior, resolver execution, or deployed runtime logic.

## Current Shape

The rendering path now follows the constraints from [`final-dag-shape-redesign.md`](./final-dag-shape-redesign.md):

- rendering consumes `Graph.View` data obtained from `resolveFlow.getGraph()`
- rendering does not depend on `ResolveFlow` internals such as compiled resolver instances or node lookup helpers
- Mermaid text is the canonical render format
- the TypeScript CLI exposes graph rendering through `--graph`
- the default CLI experience remains text-first by projecting Mermaid into a lightweight text view

This note applies to the TypeScript CLI path in [`tools/_shared/cli-ts.js`](../../../tools/_shared/cli-ts.js). The older JS CLI still has its separate `--routing` tree view.

## Source Of Truth

The renderer builds from `Graph.View` only.

Current topology inputs:

- `graph.getTopologicalOrder()`
- each node's `id`
- each node's `next` edges

The renderer does not currently enrich the graph with resolver kind labels, plan-node metadata, or descriptions. The rendered labels are the graph node ids themselves.

## Mermaid Renderer

The core renderer lives in [`src/core/graph-mermaid.ts`](../../../src/core/graph-mermaid.ts).

Current behavior:

- output starts with `flowchart TD` or `flowchart LR`
- nodes are emitted in topological order
- each node gets a Mermaid-safe alias such as `N0`, `N1`, `N2`
- the displayed label is the escaped graph node id
- edges are emitted from each node to every id in `node.next`

Current shape:

```text
flowchart LR
  N0["ROOT"]
  N1["QUOTE"]
  N2["TERMINAL"]
  N0 --> N1
  N1 --> N2
```

Properties:

- each graph node appears once
- shared downstream nodes remain shared
- output order is stable because it follows `Graph.View` topological order

## Text Projection

The default CLI output is a lightweight text projection derived from the Mermaid render, not a separate graph model.

That projection currently:

- preserves the Mermaid header such as `flowchart LR`
- prints each node label once in order
- prints outgoing edges as indented `->` lines

Example:

```text
flowchart LR

ROOT
  -> QUOTE

QUOTE
  -> TERMINAL

TERMINAL
```

This is intentionally simple. It favors stable diffs and terminal readability over ASCII-art diagrams.

## SVG Output

The same Mermaid output can also be rendered to SVG in the CLI path using `beautiful-mermaid`.

SVG is an output option for visualization convenience; it is not a separate graph representation.

## CLI Contract

The current TypeScript CLI graph surface is:

- `--graph`
  - default lightweight text projection
- `--graph --output=mermaid`
  - raw Mermaid output
- `--graph --output=svg`
  - SVG output
- `--graph --output=svg --browser`
  - opens the rendered SVG in a browser

`--browser` currently requires `--output=svg`.

## Non-Goals

The current rendering path does not:

- expose resolver kinds or descriptions in node labels
- render request-specific execution traces
- depend on `ResolveFlow` internals beyond `getGraph()`
- replace the older JS CLI's `--routing` output

Those can be revisited later if the graph CLI needs richer introspection.

## Verification

Current verification should cover:

- Mermaid rendering from `Graph.View`
- text projection derived from Mermaid
- SVG rendering from the same Mermaid source
- CLI option parsing for `--graph`, `--output=mermaid`, `--output=svg`, and `--browser`

The current tests live in:

- [`test-ts/graph-mermaid.test.js`](../../../test-ts/graph-mermaid.test.js)
- [`test-ts/hoodlefinance-cli.test.js`](../../../test-ts/hoodlefinance-cli.test.js)
