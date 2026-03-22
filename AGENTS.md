# AGENTS.md

Repo-specific standing directives for coding agents working in this project.

## Live endpoint verification

- For any new or changed functionality that depends on a live/public endpoint, do not treat fixture-based tests as sufficient.
- Before declaring the work complete, run at least one real smoke test against the live endpoint through the project tooling, usually `node tools/cli.js ...`.
- If the live endpoint behavior does not match the mocked test behavior, treat the implementation as unverified and do not ship docs or claims that say it works.
- If live verification is impossible in the current environment, say so explicitly and leave the change in an unverified state rather than presenting it as done.
- Do not base implementation details on information that is unavailable locally because of sandbox restrictions. If an out-of-sandbox check could resolve the uncertainty, request escalation and inspect the real behavior before deciding.

## Environment and hook verification

- When validating contributor setup, shell initialization, or git-hook behavior, prefer the developer's real user environment over a temporary sandbox-only or `/tmp` toolchain.
- Do not treat a throwaway verification environment as proof that the user's normal `git commit` or shell workflow is correctly configured.
- If a hook depends on tools such as `node`, `npm`, or `python`, verify that those tools are available from the same environment a developer would actually use for commits.
- If an environment override is required for one command, explain why it must be part of the same process invocation instead of implying that shell state persists across tool calls.
- If installing a small system tool would materially simplify the workflow, it is fine to suggest or request that tool instead of repeatedly working around its absence (if sudo access is needed, ask me to run for you)

## Escalated git operations

- Keep escalated git commands minimal and single-purpose whenever possible.
- Do not bundle staging, environment bootstrapping, dependency installation, and commit creation into one escalated shell command unless there is no practical alternative.
- If the sandbox blocks writes to `.git`, ask only for the specific git operation that needs escalation.

## Checkpoint discipline

- When a behavior is covered only by local mocks or unit tests but still depends on real platform behavior, treat the work as a checkpoint rather than as fully validated.
- Do not strengthen docs or user-facing claims beyond what was actually verified in the live platform.
- Do not change the approved Privacy Policy or Terms of Service text unless the user explicitly asks for those documents to be edited.

## Website workflow

- For the Docusaurus site, prefer the live dev server at `localhost:3000` for normal content, style, and layout iteration.
- Do not rerun a full production build after every small website tweak just to confirm visible changes.
- Use `npm run build` for website checkpoints, pre-commit validation, or when checking production-only behavior.
- Keep website validation proportional to the change: use the lightest check that still verifies the claim being made.

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
- Do not manually assemble release notes for a release. The primary release path is the GitHub Actions flow: run `Release Prepare`, review the generated PR, and let the merged `release/vX.Y.Z` PR trigger `Release Publish`.
- The Actions-based release flow is the default for an actual release cut; treat `node tools/release.js prepare <x.y.z>` as repo-local release machinery and a maintainer fallback, not the primary operator workflow.
- `prepare` is the built-in local release verification gate; it runs from a clean git worktree, then runs the test suites and demo-sheet dry run before consuming fragments.
- Because `prepare` relies on git-backed cleanup, release fragments should already be committed before a release cut.
- Use `node tools/release.js publish <x.y.z>` only as a local maintainer fallback after the release changes are reviewed and committed, since it tags, pushes, and creates the GitHub Release from the per-release notes file.
- Do not edit GitHub Release notes independently from the repo-managed notes.
- The current pasted Apps Script install path is manual. Do not design or imply a self-updating bound-script workflow unless the task explicitly asks for that.
- Longer-term upgrade improvements should assume an add-on-oriented direction, but that is separate from the current release workflow.

## Review scope

- When asked to review a commit, pull request, or diff, cover correctness, completeness, documentation, and internal consistency, not just obvious bugs.
- When applicable, also verify that the change includes an appropriate `changes.d/` fragment and that the fragment is accurate, user-facing, and consistent with the implementation and docs.
