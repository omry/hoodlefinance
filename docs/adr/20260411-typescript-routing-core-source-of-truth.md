---
status: Active
updated: 2026-04-11
summary: Treat the TypeScript routing core under `src/` as the canonical implementation surface for new routing-core work, while keeping legacy JS and Apps Script packaging surfaces where they are still required.
---

# ADR: TypeScript Routing Core As Source Of Truth

## Context

The project still contains multiple runtime surfaces:

- the legacy Apps Script-oriented `hoodlefinance.js`
- the TypeScript core under `src/core/`
- TypeScript-built standalone and Apps Script adapters under `dist/ts/` and
  `src/appscript/`

The repo also has current TypeScript build, test, smoke, and comparison paths
such as `build:ts`, `hoodlefinance.ts`, `smoke.ts`, `smoke:ts:appscript`, and
`compare:modes`.

The repo is therefore in a mixed-state migration: it is not "all TypeScript"
in one step, but the routing core itself now has a real maintained TypeScript
implementation and test surface.

## Decision

Treat the TypeScript routing core under `src/core/` as the canonical
implementation surface for new routing-core work.

In practice:

- new routing-core behavior should land in TypeScript first
- current graph/runtime design decisions should be expressed against the
  TypeScript core
- legacy JS remains as a compatibility, packaging, and maintainer-operational
  surface where it is still required
- Apps Script packaging and deployment surfaces may continue to consume
  generated or built artifacts rather than becoming the source of truth for
  routing-core behavior

This is not a commitment to rewrite every repo surface into TypeScript
immediately. It is a source-of-truth decision for the routing core.

## Consequences

- Current routing design docs can treat the TypeScript core as the main
  implementation reference.
- Legacy JS paths remain important, but they should not quietly become the
  design authority for new routing-core behavior.
- Packaging, release, demo-sync, and add-on workflows may still depend on
  `hoodlefinance.js` or built Apps Script outputs for some time.
- Runtime parity work remains necessary while the mixed-state migration
  continues and both surfaces still exist.

## Related Docs

- [`../design/routing/final-dag-shape-redesign.md`](../design/routing/final-dag-shape-redesign.md)
- [`../design/routing/resolve-flow-rendering.md`](../design/routing/resolve-flow-rendering.md)
- [`../design/routing/typescript-routing-migration.md`](../design/routing/typescript-routing-migration.md)
- [`../../package.json`](../../package.json)
