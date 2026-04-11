# AGENTS.md

Repo-specific directives for coding agents working in this project.

## Documentation map

- Canonical repo docs index: [`docs/INDEX.md`](./docs/INDEX.md)
- Active design docs: [`docs/design/`](./docs/design/)
- ADRs: [`docs/adr/`](./docs/adr/)
- Historical design docs: [`docs/design/archive/`](./docs/design/archive/) and archived or superseded notes kept in-topic under [`docs/design/`](./docs/design/)
- If a doc's current status is unclear, prefer current docs over archived ones and trace outward from [`docs/INDEX.md`](./docs/INDEX.md).

## Stop and ask

- If a tracked repo file appears unexpectedly renamed, moved, regenerated, deleted, or otherwise changed, stop and ask before reverting, recreating, reclassifying, or staging over that change.
- Do not change the approved Privacy Policy or Terms of Service text unless the user explicitly asks for those documents to be edited.

## Verification

- For any new or changed functionality that depends on a live or public endpoint, test it in two layers:
  - run fixture-based or unit tests for the local logic
  - run at least one real smoke test through the project tooling, usually `npm run smoke -- ...`
- If the real smoke test disagrees with the mocked or fixture-based tests, trust the real result and do not call the change verified.
- If live verification is blocked by the current environment, request escalation if that would unblock it. If not, stop and ask for guidance

## Environment and hooks

- When validating contributor setup, shell initialization, or git-hook behavior, verify it from the same environment a developer would actually use, such as a normal shell session or `git commit`, not only from a temporary sandbox-only environment.
- Prefer hooks that do not depend on nontrivial user-environment tooling.
- If an environment override is required for one command, explain why it must be part of that same process invocation.
- If a small system tool would materially simplify the workflow, it is fine to suggest it or ask the user to install it.

## Git and escalation

- Keep escalated git commands minimal and single-purpose.
- Do not bundle staging, environment bootstrapping, dependency installation, and commit creation into one escalated shell command unless there is no practical alternative.
- If a git operation requires escalation, ask only for the specific git action that needs it.

## Website

- For the Docusaurus site, prefer the live dev server at `localhost:3000` for normal content, style, and layout work.
- Do not run a full production build after every small website tweak.
- Use `npm run build` for website checkpoints, pre-commit validation, or production-only behavior.

## Release and fragments

- Do not commit, push, merge, publish, or otherwise send changes outside the local working tree unless the user explicitly asks for that outward action.
- If a change alters release automation, workflow triggers, deployment behavior, or other externally visible project mechanics, require an explicit user review checkpoint before any commit, push, merge, publish, or deployment action.
- Only product-user-visible changes should have a release fragment under `changes.d/`. Developer-only tooling, repo maintenance, and other internal workflow changes do not count unless they change the shipped product experience.
- Fragment filenames must follow `YYYYMMDD-short-change-name.<category>.md`. Supported categories are `upgrade`, `added`, `changed`, `docs`, and `fixed`. Fragment text must be concise and user-facing.
- The user handles releases. Do not edit version numbers, create release files, assemble release notes, or otherwise perform release-cut steps unless explicitly asked.
- The release process is driven by GitHub Actions. Do not improvise a manual release flow or treat GitHub Release text as the source of truth.
- The current pasted Apps Script install path is manual. Do not design or imply a self-updating bound-script workflow unless the task explicitly asks for that.

## Reviews

- When asked to review a commit, pull request, or diff, cover correctness, completeness, documentation, and internal consistency.
- Verify that each product-user-visible change includes an appropriate `changes.d/` fragment and that the fragment matches the implementation and docs.
