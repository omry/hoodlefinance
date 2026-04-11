---
status: Active
updated: 2026-04-11
summary: Use a lightweight docs lifecycle with a canonical docs index and minimal metadata for design docs and ADRs.
---

# ADR: Lightweight Documentation Lifecycle

## Context

The repo had accumulated design notes, historical implementation plans,
runbook-like docs, and contributor guidance in multiple places. Current docs
were not always easy to distinguish from historical ones, but this is also a
one-person project and should not grow a heavyweight documentation process.

The project needed a stable way for humans and coding agents to find current
guidance quickly without turning repo docs into a large policy system.

## Decision

Adopt a lightweight documentation lifecycle built around:

- a canonical docs map at [`../INDEX.md`](../INDEX.md)
- four lifecycle states: `Draft`, `Active`, `Superseded`, and `Archived`
- minimal metadata on design docs and ADRs when it materially improves clarity
- conservative retention of docs in their existing paths unless a move clearly
  improves readability

Operational docs such as demo, release, and add-on maintenance notes remain in
their existing homes and are surfaced from the canonical index rather than
being forced into a single folder.

## Consequences

- Current docs are easier to find from one stable entrypoint.
- Historical notes can stay available without being mistaken for current
  guidance.
- The repo keeps a low-process documentation model that fits solo maintenance.
- Some archived or superseded docs may remain in-topic rather than moving into
  a central archive directory.

## Related Docs

- [`../INDEX.md`](../INDEX.md)
- [`../document-lifecycle.md`](../document-lifecycle.md)
- [`../design/README.md`](../design/README.md)
