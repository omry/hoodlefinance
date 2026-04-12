# Design Notes

Use [`../INDEX.md`](../INDEX.md) as the canonical docs map for the repo.

For lifecycle guidance and metadata conventions, see [`../document-lifecycle.md`](../document-lifecycle.md).

For new design docs, start from [`./TEMPLATE.md`](./TEMPLATE.md).

## Current Design References

- Routing runtime shape: [`routing/final-dag-shape-redesign.md`](./routing/final-dag-shape-redesign.md)
- Graph-driven execution: [`routing/graph-driven-execution.md`](./routing/graph-driven-execution.md)
- Graph rendering for the TypeScript CLI: [`routing/resolve-flow-rendering.md`](./routing/resolve-flow-rendering.md)
- Identifier and attribute grammar: [`identifiers/identifier-attribute-grammar.md`](./identifiers/identifier-attribute-grammar.md)
- Google Sheets deployment strategy: [`deployment/google-sheets-deployment-strategy.md`](./deployment/google-sheets-deployment-strategy.md)
- Website deployment strategy: [`deployment/website-deployment-strategy.md`](./deployment/website-deployment-strategy.md)
- Implemented market-specific behavior: [`markets/israeli-market-fund-support.md`](./markets/israeli-market-fund-support.md)
- Cache usage matrix: [`performance/cache-matrix.md`](./performance/cache-matrix.md)

## Draft Or Planned Design Work

- Routing model draft: [`routing/hoodlefinance-routing-design.md`](./routing/hoodlefinance-routing-design.md)
- Commodity interface design: [`commodities/commodity-interface-design.md`](./commodities/commodity-interface-design.md)
- Commodity source research: [`commodities/free-commodity-data-sources.md`](./commodities/free-commodity-data-sources.md)
- Native range execution and batching reimplementation: [`performance/hoodlefinance-range-batching.md`](./performance/hoodlefinance-range-batching.md)
- Bare FX support: [`identifiers/bare-fx-support.md`](./identifiers/bare-fx-support.md)
- Canonical identifier layer: [`identifiers/canonical-identifier-layer.md`](./identifiers/canonical-identifier-layer.md)
- Symbol and exchange attributes: [`identifiers/symbol-exchange-attributes.md`](./identifiers/symbol-exchange-attributes.md)
- Routing source-gap note: [`routing/routing-source-gaps.md`](./routing/routing-source-gaps.md)

## Historical And Superseded Design Docs

- Archived historical docs: [`archive/`](./archive/)
- Superseded routing graph design: [`routing/routing-graph.md`](./routing/routing-graph.md)
- Superseded structural DAG instantiation plan: [`routing/plan-spec-dag-instantiation.md`](./routing/plan-spec-dag-instantiation.md)
- Archived TypeScript routing migration note: [`routing/typescript-routing-migration.md`](./routing/typescript-routing-migration.md)

## Topic Areas

- `routing/`: routing architecture, graph/runtime shape, and still-open routing notes
- `identifiers/`: identifier grammar, FX identifier handling, and canonical identifier work
- `deployment/`: Google Sheets and website deployment notes
- `performance/`: batching and caching notes
- `markets/`: market-specific support notes
- `commodities/`: commodity interface and source research notes

When a design note's current role is still unclear, start from the current references above and prefer docs with explicit lifecycle metadata.
