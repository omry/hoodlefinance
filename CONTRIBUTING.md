# Contributing to hoodlefinance

This is a small Apps Script project with a Node-based local test harness.

The codebase is intentionally simple:

- [`hoodlefinance.js`](./hoodlefinance.js): main Apps Script implementation
- [`test/hoodlefinance.test.js`](./test/hoodlefinance.test.js): Node unit tests
- [`tools/cli.js`](./tools/cli.js): local smoke-test wrapper
- [`tools/sync-demo-sheet.js`](./tools/sync-demo-sheet.js): public demo sheet sync tool
- [`tools/generate-support-matrix.py`](./tools/generate-support-matrix.py): support matrix generator
- [`tools/map-google-fx-coverage.py`](./tools/map-google-fx-coverage.py): parallel Google FX currency pairs coverage probe
- [`support-matrix.md`](./support-matrix.md): generated exchange coverage matrix
- [`docs/demo-sheet/`](./docs/demo-sheet/): tracked demo sheet config and TSV tab data
- [`docs/hoodlefinance-api.md`](./docs/hoodlefinance-api.md): detailed user-facing reference
- [`version.properties`](./version.properties): release metadata source of truth
- [`docs/release-notes/`](./docs/release-notes/): full-history release notes, template, and per-release notes

## License

This project should be treated as MIT-licensed.

If you are contributing changes, keep that in mind for any external code, copied snippets, or bundled assets you introduce.

## Local Testing

Run the unit tests:

```sh
node --test test/hoodlefinance.test.js
node --test test/release.test.js
node --test test/sync-demo-sheet.test.js
```

Run syntax checks:

```sh
node --check hoodlefinance.js
node --check test/hoodlefinance.test.js
node --check tools/release.js
node --check test/release.test.js
node --check tools/sync-demo-sheet.js
node --check test/sync-demo-sheet.test.js
```

Run the CLI for live smoke tests:

```sh
node tools/cli.js GOOG price
node tools/cli.js GOOG isin
node tools/cli.js ZPRX.DE isin
node tools/cli.js PSE:BDO isin
node tools/cli.js PHY077751022 name
```

Refresh the GitHub-hosted PSE ISIN map data file:

```sh
node tools/generate-pse-isin-map.js
```

The same refresh also runs as a reviewable GitHub Actions workflow and via manual dispatch:

- `Refresh PSE ISIN Map`

Release tooling commands:

```sh
node tools/release.js check-fragments
node tools/release.js prepare 0.2.6
node tools/release.js publish 0.2.6
```

`prepare` automatically runs the release verification gate:

- `node --test test/hoodlefinance.test.js`
- `node --test test/release.test.js`
- `node --test test/sync-demo-sheet.test.js`
- `node tools/sync-demo-sheet.js --dry-run` (staging config preflight only)

Run the live benchmark for scalar-vs-range performance:

```sh
node tools/benchmark.js
node tools/benchmark.js --attribute price --count 50
node tools/benchmark.js --tickers GOOG,AAPL,MSFT,AMZN,META
```

The CLI loads the Apps Script source into a local VM and proxies `UrlFetchApp.fetch()` through the local Node HTTP transport, so it is useful for checking live endpoints without pasting into Google Sheets.

Sync the demo sheet locally. The default target is staging:

```sh
node tools/sync-demo-sheet.js
```

Publish to the real public demo only when you explicitly opt in:

```sh
node tools/sync-demo-sheet.js --live-demo --dry-run
node tools/sync-demo-sheet.js --live-demo
```

The production public demo should normally be synced automatically by the release workflow after a reviewed release PR is merged. For local maintainer use, `--live-demo --dry-run` is mainly a last-minute check that you are pointed at the real public sheet. Run a local `--live-demo` sync only when you are making a demo-only fix that should go live outside the normal release flow.

Before the live sync will work, set up:

- Google OAuth desktop-app credentials at `.demo-sheet.local/oauth-client.json`
- `clasp` installed from npm and authenticated:

```sh
npm install -g @google/clasp
clasp login --no-localhost
```

The sync tool treats [`docs/demo-sheet/demo-sheet.json`](./docs/demo-sheet/demo-sheet.json) and the TSV files under [`docs/demo-sheet/`](./docs/demo-sheet/) as the source of truth for the demo sheet's structure and visible content. The default local mode targets the tracked staging sheet so testing and iterative updates do not touch the public demo. Use `--live-demo` only for the real public sheet. The tool writes local-only OAuth tokens and temporary clasp files under `.demo-sheet.local/`, which must stay untracked.

For the high-level process for adding another trusted demo maintainer, see [`docs/demo-sheet/README.md`](./docs/demo-sheet/README.md).

Generate the support matrix from live CLI probes:

```sh
python3 tools/generate-support-matrix.py
python3 tools/generate-support-matrix.py --details
python3 tools/generate-support-matrix.py --update-page
```

Map Google Finance FX page coverage across the canonical currency/crypto pair set:

```sh
python3 tools/map-google-fx-coverage.py
python3 tools/map-google-fx-coverage.py --codes USD,EUR,PHP,ILS
python3 tools/map-google-fx-coverage.py --pairs EURUSD,PHPILS,USDUSD
```

The FX coverage tool writes timestamped results under [`tmp/`](./tmp/), which stays untracked.

The generator is intentionally user-facing: it reports exchange coverage for the features a normal user calls, not the backend-specific helper attributes. It also contains a small reliability override map for combinations that are known to be flaky in practice. Use that map for long-term stability issues; do not rely on a single successful run to promote a fragile combination to stable support.

## Contribution Expectations

Changes should usually include:

1. Unit tests for any new parsing, routing, or normalization logic.
2. Documentation updates in [`docs/hoodlefinance-api.md`](./docs/hoodlefinance-api.md) and, when appropriate, [`README.md`](./README.md).
3. Live CLI checks for any source-backed change, especially new ISIN resolvers.
4. A release fragment under [`changes.d/`](./changes.d/) for substantive user-facing changes.
5. Demo-sheet TSV and config updates when the public demo should reflect the new behavior.

During normal feature work, do not manually bump versions. Keep fragments current, then let the release tool propagate the version metadata into the runtime and docs when cutting a release.

If a change adds a new source or exchange path, include both:

- fixture-based tests in `test/hoodlefinance.test.js`
- at least one real-world smoke-test example you actually verified

For any new or changed functionality that depends on a live/public endpoint, live verification is mandatory before calling the change done. A mocked unit test is not enough on its own. Run at least one real check through the project tooling, usually `node tools/cli.js ...`, and if that is not possible in the current environment, state explicitly that the behavior is unverified.

## What to Be Careful About

- Public endpoints are brittle. Prefer exact parsing of stable fields over loose scraping.
- For symbol-page sources, reject mismatches instead of silently accepting nearby results.
- Keep generic `isin` routing conservative. Only change defaults when coverage is strong enough to justify it.
- If a source is useful but not yet strong enough as a default, add it as an explicit attribute first.
- Preserve Apps Script compatibility. The main source file should stay usable when pasted directly into `Code.gs`.
- Keep tests in `test/` and helper scripts in `tools/` so the repo layout stays predictable.

## Documentation Rule

If behavior changes, the docs should change in the same PR/commit.

That includes:

- supported attributes
- exchange routing
- limitations
- examples

If the user-facing behavior changed and the docs did not, the change is incomplete.

## Release Workflow

User-facing releases are repo-managed.

- Preferred path: use the GitHub Actions workflows under `.github/workflows/` to prepare the release PR and let the merged release PR trigger publish plus demo sync automatically.
- Local `node tools/release.js ...` commands remain available as a maintainer fallback and as the implementation engine behind the prepare step.
- Add one release fragment under [`changes.d/`](./changes.d/) for each user-visible change that should appear in the next release.
- Each release fragment must be exactly one top-level bullet that starts with `- `. One fragment maps to one rendered release-note bullet.
- Run `node tools/release.js check-fragments` to validate fragment filenames and contents without mutating anything.
- Recommended local setup: run `git config core.hooksPath .githooks` so commits use the repo-managed pre-commit hook, which runs `node tools/release.js check-fragments`.
- Run `node tools/release.js prepare x.y.z` from a clean git worktree to update [`version.properties`](./version.properties), stamp the runtime/docs version fields, create [`docs/release-notes/vX.Y.Z.md`](./docs/release-notes/), regenerate [`docs/release-notes/RELEASE_NOTES.md`](./docs/release-notes/RELEASE_NOTES.md), and consume the fragments.
- `prepare` automatically runs the release verification suite and aborts without consuming fragments if verification fails.
- `prepare` relies on git-backed cleanup if verification fails, so release fragments should already be committed before a release cut.
- The per-release file is rendered through the tracked template at [`docs/release-notes/TEMPLATE.md`](./docs/release-notes/TEMPLATE.md), similar in spirit to a towncrier-style release template.
- `prepare` does not create a git commit. Review and commit the release changes before publishing.
- `node tools/release.js publish x.y.z` remains as a local maintainer fallback, but the normal GitHub Actions path is to merge the prepared release PR and let `Release Publish` handle the tag, GitHub Release, and demo sync.
- Do not edit GitHub Release notes independently from the repo-managed release files.

Recommended GitHub Actions flow:

1. Commit the release fragments on `main`.
2. Run the `Release Prepare` workflow with the target version. It opens a generated release PR from `release/vX.Y.Z`.
3. Review and merge that release PR. Merging is the maintainer approval gate.
4. The merged `release/vX.Y.Z` PR automatically triggers `Release Publish`, which tags the merge commit, creates the GitHub Release, and syncs the public demo from the released tag with `node tools/sync-demo-sheet.js --live-demo`.
5. Use the manual `Release Publish` workflow only as a fallback if the automatic merge-triggered publish path needs to be rerun or repaired.

Demo-sync workflow secrets:

- `DEMO_SHEET_OAUTH_CLIENT_JSON`
- `DEMO_SHEET_OAUTH_TOKEN_JSON`
- `CLASP_RC_JSON` from your authenticated global `~/.clasprc.json`

The demo-sync job writes those secret values back to the same file paths used by the local flow. All three secret values must be valid JSON.

Maintainer release checklist:

1. Review pending fragments under [`changes.d/`](./changes.d/) and make sure each user-visible change is covered once, with end-user wording.
2. Optional: run `node tools/release.js check-fragments`.
3. Optional: run any extra smoke checks beyond the built-in `prepare` verification gate.
4. Run the `Release Prepare` workflow for `x.y.z`, or make sure the git worktree is clean and run `node tools/release.js prepare x.y.z`.
5. Inspect the meaningful generated release artifacts:
   [version.properties](./version.properties),
   [`docs/release-notes/vX.Y.Z.md`](./docs/release-notes/),
   and [`docs/release-notes/RELEASE_NOTES.md`](./docs/release-notes/RELEASE_NOTES.md).
6. Merge the release PR, or if you used the local fallback, commit the reviewed release changes, for example `git commit -m "Release v0.9.0"`.
7. Confirm that `Release Publish` ran for the merged release PR and completed both jobs:
   the publish job and the demo-sync job.

If the change affects exchange coverage or source support, regenerate [`support-matrix.md`](./support-matrix.md) with `python3 tools/generate-support-matrix.py --update-page`.
