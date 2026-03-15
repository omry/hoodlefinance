# Release fragments

Add one Markdown fragment here for each user-visible change that should appear in the next release.

Filename format:

`YYYYMMDD-slug.<upgrade|added|changed|fixed>.md`

Examples:

- `20260315-release-notes.added.md`
- `20260315-pse-cache.fixed.md`

Fragment guidelines:

- Write for end users first.
- Keep each fragment to one short paragraph or bullet list.
- Use `upgrade` only for notes users should read before updating.

Validation:

- Run `node tools/release.js check-fragments` to validate fragment filenames and contents before preparing a release.
- `node tools/release.js prepare x.y.z` runs the same fragment validation automatically before it writes release files.
- `prepare` starts only from a clean git worktree and uses git-backed cleanup on verification failure, so fragments should already be committed by the time you cut a release.

The release workflow consumes these fragments into a per-release file under [`docs/release-notes/`](../docs/release-notes/) using the tracked template at [`docs/release-notes/TEMPLATE.md`](../docs/release-notes/TEMPLATE.md), and regenerates the full release history file at [`docs/release-notes/RELEASE_NOTES.md`](../docs/release-notes/RELEASE_NOTES.md).
