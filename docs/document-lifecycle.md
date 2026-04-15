# Document Lifecycle

This repo uses a lightweight documentation lifecycle.

The goal is to keep current docs easy to find without turning a one-person project into a paperwork project.

## Statuses

- `Draft`: useful work-in-progress notes that are not yet the default reference
- `Active`: current guidance
- `Superseded`: replaced by a newer doc or decision, but still kept nearby as a predecessor
- `Archived`: historical context only, usually moved under `docs/design/archive/`

Not every repo doc needs lifecycle metadata.

In practice:

- design docs should usually carry status metadata
- ADRs should carry status metadata
- contributor docs, release notes, and user-facing docs can stay lightweight unless a stronger signal is helpful

## When To Write What

Write a full design doc when the change affects architecture, invariants, interfaces, rollout, or nontrivial operations.

Write an ADR when one durable decision is the main thing worth preserving and the surrounding design is otherwise small.

If a short README or runbook is enough, prefer that over creating a heavier process artifact.

## Metadata

For new or materially updated design docs, use:

```md
---
status: Draft|Active|Superseded|Archived
updated: YYYY-MM-DD
summary: One-line purpose
supersedes: optional path
superseded_by: optional path
---
```

Use only the fields that help. Do not retrofit metadata everywhere just for consistency points.

## Superseded And Archived Docs

If a doc is superseded, say what replaced it.

That can live in:

- the metadata block
- a short note near the top of the file

Archived docs are historical only. They should use `status: Archived` in frontmatter and a short archive note near the top of the file.

They should not be treated as current guidance unless a newer doc points back to them for context.

## Update Expectations

If a PR changes architecture, invariants, interfaces, rollout, or maintainer operations, update the relevant docs in the same change.

When you add a new current design doc, ADR, or runbook, also update [`INDEX.md`](./INDEX.md) so humans and agents can find it quickly.
