# Runbooks

This directory is the landing page for concise operational runbooks and related
maintainer docs.

Most runbook-like docs stay in their existing locations by design to avoid unnecessary churn.

Current operational docs to use:

- Demo-sheet maintenance: [`../demo-sheet/README.md`](../demo-sheet/README.md)
- Release workflow and maintainer checklist: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
- Release fragments: [`../../changes.d/README.md`](../../changes.d/README.md)
- Release history and generated notes: [`../release-notes/RELEASE_NOTES.md`](../release-notes/RELEASE_NOTES.md)
- Google Sheets add-on operations: [`../google-sheets-editor-addon/README.md`](../google-sheets-editor-addon/README.md)
- Local GitHub Actions workflow testing with `act`: [`../../.act/README.md`](../../.act/README.md)

`demo` and `release` stay in those existing locations on purpose rather than
being moved into `docs/runbooks/`.

Move docs into this directory only when the benefit is clear and the current status is high-confidence.
