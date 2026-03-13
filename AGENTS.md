# AGENTS.md

Repo-specific standing directives for coding agents working in this project.

## Live endpoint verification

- For any new or changed functionality that depends on a live/public endpoint, do not treat fixture-based tests as sufficient.
- Before declaring the work complete, run at least one real smoke test against the live endpoint through the project tooling, usually `node tools/cli.js ...`.
- If the live endpoint behavior does not match the mocked test behavior, treat the implementation as unverified and do not ship docs or claims that say it works.
- If live verification is impossible in the current environment, say so explicitly and leave the change in an unverified state rather than presenting it as done.

