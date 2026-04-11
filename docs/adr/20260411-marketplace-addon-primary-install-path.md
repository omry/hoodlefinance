---
status: Active
updated: 2026-04-11
summary: Use the Google Workspace Marketplace add-on as the primary public install path, while keeping manual bound-script installs for contributors and the demo sheet.
---

# ADR: Marketplace Add-On As Primary Public Install Path

## Context

`HOODLEFINANCE` started from a manual bound Apps Script installation model.
That path works for contributors and controlled spreadsheets, but it creates a
rough first-run experience for ordinary users and makes upgrades manual.

The repo now has a published Google Sheets Editor add-on and current public
installation docs already point users to the Marketplace listing.

## Decision

Treat the Google Workspace Marketplace Sheets add-on as the primary public
installation path.

Keep manual bound-script installation only for:

- contributors
- the tracked demo sheet
- maintainer-owned automation and controlled spreadsheet environments

Do not treat self-updating bound scripts as a supported public distribution
architecture.

## Consequences

- Public installs have a normal add-on workflow instead of copy/paste setup.
- Release and support guidance can center on the add-on as the default user
  experience.
- Maintainer and demo-sheet flows remain separate because they need more direct
  script-project control.
- The project accepts the operational tradeoffs of add-on packaging,
  Marketplace policy, and shared Apps Script execution limits.

## Related Docs

- [`../design/deployment/google-sheets-deployment-strategy.md`](../design/deployment/google-sheets-deployment-strategy.md)
- [`../google-sheets-editor-addon/README.md`](../google-sheets-editor-addon/README.md)
- [`../../website/docs/installation.md`](../../website/docs/installation.md)
