# Documentation Index

This is the canonical map for repo-local documentation.

Use it to find the current internal docs first, then fall back to older or more specialized notes only when needed.

## Start Here

- Repo and product overview: [`../README.md`](../README.md)
- Contributor workflow: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- Coding-agent operating rules: [`../AGENTS.md`](../AGENTS.md)
- Docs lifecycle and metadata rules: [`./document-lifecycle.md`](./document-lifecycle.md)

## Internal Technical Docs

There is not yet a single repo-local system-architecture overview.

For now, use:

- [`../README.md`](../README.md) for the high-level product and repo overview
- [`./design/README.md`](./design/README.md) for the active internal design-doc map
- topic-specific design docs under [`./design/`](./design/)

### Active Design Docs

- Design index: [`./design/README.md`](./design/README.md)
- Routing runtime shape: [`./design/routing/final-dag-shape-redesign.md`](./design/routing/final-dag-shape-redesign.md)
- Graph-driven execution: [`./design/routing/graph-driven-execution.md`](./design/routing/graph-driven-execution.md)
- Graph rendering for the TypeScript CLI: [`./design/routing/resolve-flow-rendering.md`](./design/routing/resolve-flow-rendering.md)
- Subgraph call support: [`./design/routing/subgraph-call-support.md`](./design/routing/subgraph-call-support.md)
- FX flow port to subgraph calls: [`./design/routing/fx-flow-port-to-subgraph-calls.md`](./design/routing/fx-flow-port-to-subgraph-calls.md)
- Identifier and attribute grammar: [`./design/identifiers/identifier-attribute-grammar.md`](./design/identifiers/identifier-attribute-grammar.md)
- Google Sheets deployment strategy: [`./design/deployment/google-sheets-deployment-strategy.md`](./design/deployment/google-sheets-deployment-strategy.md)
- Website deployment strategy: [`./design/deployment/website-deployment-strategy.md`](./design/deployment/website-deployment-strategy.md)
- Implemented market support note: [`./design/markets/israeli-market-fund-support.md`](./design/markets/israeli-market-fund-support.md)
- Cache usage matrix: [`./design/performance/cache-matrix.md`](./design/performance/cache-matrix.md)
- Design template: [`./design/TEMPLATE.md`](./design/TEMPLATE.md)

### ADRs

- ADR directory: [`./adr/`](./adr/)
- ADR template: [`./adr/TEMPLATE.md`](./adr/TEMPLATE.md)
- Lightweight docs lifecycle: [`./adr/20260411-lightweight-doc-lifecycle.md`](./adr/20260411-lightweight-doc-lifecycle.md)
- Marketplace add-on as primary install path: [`./adr/20260411-marketplace-addon-primary-install-path.md`](./adr/20260411-marketplace-addon-primary-install-path.md)
- Docusaurus site on GitHub Pages: [`./adr/20260411-docusaurus-github-pages-website.md`](./adr/20260411-docusaurus-github-pages-website.md)
- `ResolveFlow` and `Graph.View` runtime shape: [`./adr/20260411-resolve-flow-graph-runtime-shape.md`](./adr/20260411-resolve-flow-graph-runtime-shape.md)
- TypeScript routing core as source of truth: [`./adr/20260411-typescript-routing-core-source-of-truth.md`](./adr/20260411-typescript-routing-core-source-of-truth.md)

### Runbooks And Operations

- Runbooks landing page: [`./runbooks/README.md`](./runbooks/README.md)
- Demo-sheet maintenance: [`./demo-sheet/README.md`](./demo-sheet/README.md)
- Release workflow and maintainer checklist: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- Release fragments: [`../changes.d/README.md`](../changes.d/README.md)
- Release history and generated notes: [`./release-notes/RELEASE_NOTES.md`](./release-notes/RELEASE_NOTES.md)
- Google Sheets add-on operations and review notes: [`./google-sheets-editor-addon/README.md`](./google-sheets-editor-addon/README.md)
- Local GitHub Actions workflow testing with `act`: [`../.act/README.md`](../.act/README.md)

Prefer the docs above over ad hoc notes elsewhere in the repo.

### Historical Docs

- Historical design docs: [`./design/archive/`](./design/archive/)
- Superseded routing docs: [`./design/routing/routing-graph.md`](./design/routing/routing-graph.md) and [`./design/routing/plan-spec-dag-instantiation.md`](./design/routing/plan-spec-dag-instantiation.md)
- Archived TypeScript routing migration note: [`./design/routing/typescript-routing-migration.md`](./design/routing/typescript-routing-migration.md)

Archived and superseded docs are historical context only. Prefer current docs in [`./design/`](./design/) unless you are checking migration history or older design intent.

## User-Facing Docs

These docs describe the shipped product and website rather than the internal design-doc lifecycle:

- Website docs root: [`../website/docs/intro.md`](../website/docs/intro.md)
- API overview: [`../website/docs/api/overview.md`](../website/docs/api/overview.md)
- Installation: [`../website/docs/installation.md`](../website/docs/installation.md)
- Support matrix: [`../website/docs/support-matrix.md`](../website/docs/support-matrix.md)
