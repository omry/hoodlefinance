# AGENTS.md

Repo-specific standing directives for coding agents working in this project.

## Live endpoint verification

- For any new or changed functionality that depends on a live/public endpoint, do not treat fixture-based tests as sufficient.
- Before declaring the work complete, run at least one real smoke test against the live endpoint through the project tooling, usually `node tools/cli.js ...`.
- If the live endpoint behavior does not match the mocked test behavior, treat the implementation as unverified and do not ship docs or claims that say it works.
- If live verification is impossible in the current environment, say so explicitly and leave the change in an unverified state rather than presenting it as done.

## Release process

- Implementing a fix is not the same as committing, pushing, merging, publishing, or otherwise sending changes outside the local working tree.
- Unless the user explicitly asks for that outward action after review, stop after local implementation, verification, and a summary of the proposed changes.
- Pushing is always a separate approval checkpoint. Do not infer push approval from phrases such as "do that", "fix it", or "implement it".
- If a change alters release automation, workflow triggers, deployment behavior, or other externally visible project mechanics, require an explicit user review checkpoint before any commit or push.
- `version.properties` is the source of truth for the current release version metadata.
- Per-release note files under `docs/release-notes/` are the source of truth for release content.
- `docs/release-notes/RELEASE_NOTES.md` is the generated full-history release notes file derived from the per-release files.
- Do not treat GitHub Releases as the primary record.
- User-visible changes should usually include a release fragment under `changes.d/`, even if the current task is not cutting a release yet.
- Keep release fragments current while making user-visible changes. Do not leave a substantive feature or fix without adding or updating the corresponding fragment.
- Fragment filenames must follow `YYYYMMDD-slug.<category>.md`.
- Supported fragment categories are `upgrade`, `added`, `changed`, and `fixed`.
- Fragment text should be concise and user-facing, not an internal implementation changelog.
- Do not manually edit version numbers as part of normal feature work unless the task is explicitly a release cut.
- Do not manually assemble release notes for a release. Use `node tools/release.js prepare <x.y.z>` so `version.properties`, `HOODLEFINANCE_VERSION_`, `README.md`, `docs/hoodlefinance-api.md`, `docs/release-notes/vX.Y.Z.md`, and `docs/release-notes/RELEASE_NOTES.md` stay in sync.
- `prepare` is also the built-in release verification gate; it runs from a clean git worktree, then runs the test suites and demo-sheet dry run before consuming fragments.
- Because `prepare` now relies on git-backed cleanup, release fragments should already be committed before a release cut.
- Prefer the GitHub Actions release flow when the task is about an actual release cut: run `Release Prepare`, then let the merged `release/vX.Y.Z` PR trigger `Release Publish`, which also syncs the demo.
- Use `node tools/release.js publish <x.y.z>` only after the release changes are reviewed and committed, since it tags, pushes, and creates the GitHub Release from the per-release notes file.
- Do not edit GitHub Release notes independently from the repo-managed notes.
- The current pasted Apps Script install path is manual. Do not design or imply a self-updating bound-script workflow unless the task explicitly asks for that.
- Longer-term upgrade improvements should assume an add-on-oriented direction, but that is separate from the current release workflow.
