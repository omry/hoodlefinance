# Contributing to hoodlefinance

This is a small Apps Script project with a Node-based local test harness.

## Development Setup

The repo now uses machine-readable local setup files for the main contributor toolchain:

- [`package.json`](./package.json) is the source of truth for local Node-based tooling and scripts
- [`.nvmrc`](./.nvmrc) and [`.node-version`](./.node-version) pin the supported Node release line for contributors who use `nvm`, `fnm`, `asdf`, or similar tools
- the Python helper scripts currently use only the Python standard library, so there is no separate Python package install step yet

The repo also includes tracked local git hooks under [`.githooks/`](./.githooks/). After bootstrap, enable them once with `npm run hooks:install`.

On a fresh Ubuntu or WSL install, the most likely missing pieces for ordinary development are:

- `nvm`
- a supported `node` / `npm` toolchain, installed through `nvm`
- `python3` if you want to run the reporting scripts under `tools/`

Normal feature work does not require Google OAuth credentials or `clasp` authentication. Those are only needed if you want to sync a demo sheet target, or for maintainer deployment flows.

The repo separates those Google auth paths on purpose:

- local staging demo syncs use `.demo-sheet.local/staging/`
- local public `--production` syncs use `.demo-sheet.local/production/`
- add-on deployment uses `.addon-deploy.local/production/` and `.addon-deploy.local/staging/`

That keeps staging and production isolated from each other, while still allowing different Google Cloud projects to keep separate auth files.

To confirm which `clasp` accounts the configured staging and production flows will use:

```sh
npm run clasp:user
```

The public add-on deployment helper is also maintainer-only. It uses the same repo-pinned `clasp` toolchain pattern, but now supports separate staging and production add-on targets with their own local auth/config files under `.addon-deploy.local/`.

If you do not already have `nvm`, install it first:

```sh
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
exec $SHELL -l
```

Recommended bootstrap on a fresh machine after `nvm` is available:

```sh
nvm install                  # install the repo-pinned Node version
nvm use                      # switch this shell to that Node version
npm install                  # install local development dependencies
```

That gives you:

- Node `24.x`, which is the current repo target
- the repo-pinned local `clasp` binary under `node_modules/.bin/`

If you do not use `nvm`, install a Node `24.x` release by another method, then run:

```sh
npm install
```

Quick sanity checks after bootstrap:

```sh
node -v
npm -v
npm test
npm run check
```

The codebase is intentionally simple:

- [`hoodlefinance.js`](./hoodlefinance.js): main Apps Script implementation
- [`test/hoodlefinance.test.js`](./test/hoodlefinance.test.js): Node unit tests
- [`tools/_shared/cli.js`](./tools/_shared/cli.js): local smoke-test wrapper
- [`tools/demo/sync.js`](./tools/demo/sync.js): public demo sheet sync tool
- [`tools/generate-support-matrix.py`](./tools/generate-support-matrix.py): support matrix generator
- [`tools/map-google-fx-coverage.py`](./tools/map-google-fx-coverage.py): parallel Google FX currency pairs coverage probe
- [`website/docs/support-matrix.md`](./website/docs/support-matrix.md): generated exchange coverage matrix
- [`docs/demo-sheet/`](./docs/demo-sheet/): tracked demo sheet config and TSV tab data
- [`website/docs/api/overview.md`](./website/docs/api/overview.md): detailed user-facing reference
- [`version.properties`](./version.properties): release metadata source of truth
- [`docs/release-notes/`](./docs/release-notes/): full-history release notes, template, and per-release notes

## License

This project is licensed under the Mozilla Public License 2.0 (`MPL-2.0`).

If you contribute changes, make sure any external code, copied snippets, or bundled assets you introduce are compatible with `MPL-2.0`.

## Local Testing

Run the unit tests:

```sh
npm test
```

If you want to run them individually:

```sh
npm run test:hoodlefinance
npm run test:release
npm run test:sync-demo-sheet
```

Run syntax checks:

```sh
npm run check:syntax
```

Run the CLI for live smoke tests:

```sh
npm run smoke -- GOOG price
npm run smoke -- GOOG isin
npm run smoke -- ZPRX.DE isin
npm run smoke -- PSE:BDO isin
npm run smoke -- PHY077751022 name
```

Refresh the GitHub-hosted PSE ISIN map data file:

```sh
npm run pse:refresh
```

The same refresh also runs as a reviewable GitHub Actions workflow and via manual dispatch:

- `Refresh PSE ISIN Map`

Release tooling commands:

```sh
npm run release:check-fragments
npm run release:prepare -- 0.2.6
npm run release:publish -- 0.2.6
```

`prepare` automatically runs the release verification gate:

- `node --test test/hoodlefinance.test.js`
- `node --test test/release.test.js`
- `node --test test/sync-demo-sheet.test.js`
- `npm run demo:sync:staging:dry-run` (staging config preflight)
- `npm run demo:sync:production:dry-run` (public demo config preflight)

Run the live benchmark for scalar-vs-range performance:

```sh
npm run benchmark
npm run benchmark -- --attribute price --count 50
npm run benchmark -- --tickers GOOG,AAPL,MSFT,AMZN,META
```

The CLI loads the Apps Script source into a local VM and proxies `UrlFetchApp.fetch()` through the local Node HTTP transport, so it is useful for checking live endpoints without pasting into Google Sheets.

Sync the demo sheet locally. Choose the target explicitly. For staging:

```sh
npm run demo:sync:staging
```

Publish to the real public demo only when you explicitly opt in:

```sh
npm run demo:sync:production:dry-run
npm run demo:sync:production
```

The production public demo should normally be synced automatically by the release workflow after a reviewed release PR is merged. For local maintainer use, `--production --dry-run` is mainly a last-minute check that you are pointed at the real public sheet. Run a local `--production` sync only when you are making a demo-only fix that should go live outside the normal release flow.

When you pass extra flags through `npm run`, always include the `--` separator. For example, `npm run demo:sync -- --production --dry-run`. Without that separator, npm can consume flags like `--dry-run` itself instead of passing them to the sync tool.

Before a staging sync will work, you need to set up the staging target's own Google Cloud credentials under `.demo-sheet.local/staging/`. If you want staging to stay fully isolated from production, use a separate Google Cloud project and desktop OAuth client for staging.

Set up the following:

1. **OAuth Client for Sheets API**:
   - Go to Google Cloud Console and create a new project (e.g. `HoodleFinance Demo Staging`).
   - Enable the **Google Sheets API**, **Google Drive API**, and **Apps Script API**.
   - Generate an OAuth 2.0 Client ID (Application type: "Desktop app").
   - Download the JSON file and save it as `.demo-sheet.local/staging/oauth-client.json` (this is ignored by `git`).
2. **Clasp Authentication**:
   - Create the staging target's dedicated `clasp` auth file with the same Google account:
   ```sh
   npm exec -- clasp -A .demo-sheet.local/staging/.clasprc.json login --creds .demo-sheet.local/staging/oauth-client.json
   ```

_(Note: The official production demo and automated add-on release pipelines use their own dedicated repo-level credentials securely managed through GitHub Secrets.)_

If the localhost callback flow does not work in your environment, retry the sync with `--no-localhost`.

The sync tool treats [`docs/demo-sheet/demo-sheet.json`](./docs/demo-sheet/demo-sheet.json) and the TSV files under [`docs/demo-sheet/`](./docs/demo-sheet/) as the source of truth for the demo sheet's structure and visible content. The default local mode targets a staging sheet recorded in the ignored local override file [`docs/demo-sheet/demo-sheet-staging.json`](./docs/demo-sheet/demo-sheet-staging.json). That keeps iterative testing away from the public demo without pretending the staging target is repo-tracked. Use `--production` only for the real public sheet. The tool writes target-local OAuth tokens, `clasp` auth, and temporary project files under `.demo-sheet.local/staging/` or `.demo-sheet.local/production/`, which must stay untracked.

For the high-level process for adding another trusted demo maintainer, see [`docs/demo-sheet/README.md`](./docs/demo-sheet/README.md).

Generate the support matrix from live CLI probes:

```sh
npm run support-matrix
npm run support-matrix -- --details
npm run support-matrix -- --update-page
```

Map Google Finance FX page coverage across the canonical currency/crypto pair set:

```sh
npm run fx-coverage
npm run fx-coverage -- --codes USD,EUR,PHP,ILS
npm run fx-coverage -- --pairs EURUSD,PHPILS,USDUSD
```

The FX coverage tool writes timestamped results under [`tmp/`](./tmp/), which stays untracked.

The generator is intentionally user-facing: it reports exchange coverage for the features a normal user calls, not the backend-specific helper attributes. It also contains a small reliability override map for combinations that are known to be flaky in practice. Use that map for long-term stability issues; do not rely on a single successful run to promote a fragile combination to stable support.

## Contribution Expectations

Changes should usually include:

1. Unit tests for any new parsing, routing, or normalization logic.
2. Documentation updates in [`website/docs/api/overview.md`](./website/docs/api/overview.md) and, when appropriate, [`README.md`](./README.md).
3. Live CLI checks for any source-backed change, especially new ISIN resolvers.
4. A release fragment under [`changes.d/`](./changes.d/) for substantive user-facing changes.
5. Demo-sheet TSV and config updates when the public demo should reflect the new behavior.

During normal feature work, do not manually bump versions. Keep fragments current, then let the release tool propagate the version metadata into the runtime and docs when cutting a release.

If a change adds a new source or exchange path, include both:

- fixture-based tests in `test/hoodlefinance.test.js`
- at least one real-world smoke-test example you actually verified

For any new or changed functionality that depends on a live/public endpoint, live verification is mandatory before calling the change done. A mocked unit test is not enough on its own. Run at least one real check through the project tooling, usually `npm run smoke -- ...`, and if that is not possible in the current environment, state explicitly that the behavior is unverified.

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
- Local `npm run release:*` commands remain available as a maintainer fallback and as the implementation engine behind the prepare step.
- Add one release fragment under [`changes.d/`](./changes.d/) for each user-visible change that should appear in the next release.
- Each release fragment must be exactly one top-level bullet that starts with `- `. One fragment maps to one rendered release-note bullet.
- Use the `docs` fragment type for user-facing documentation-only changes.
- You can also run `npm run release:check-fragments` manually without mutating anything.
- Run `npm run release:prepare -- x.y.z --dry-run` to preview the next per-release notes without changing files.
- Run `npm run release:prepare -- x.y.z` from a clean git worktree to update [`version.properties`](./version.properties), stamp the runtime/docs version fields, create [`docs/release-notes/vX.Y.Z.md`](./docs/release-notes/), regenerate [`docs/release-notes/RELEASE_NOTES.md`](./docs/release-notes/RELEASE_NOTES.md), and consume the fragments.
- `prepare` automatically runs the release verification suite and aborts without consuming fragments if verification fails.
- `prepare` relies on git-backed cleanup if verification fails, so release fragments should already be committed before a release cut.
- The per-release file is rendered through the tracked template at [`docs/release-notes/TEMPLATE.md`](./docs/release-notes/TEMPLATE.md), similar in spirit to a towncrier-style release template.
- `prepare` does not create a git commit. Review and commit the release changes before publishing.
- `npm run release:publish -- x.y.z` remains as a local maintainer fallback, but the normal GitHub Actions path is to merge the prepared release PR and let `Release Publish` handle the tag, GitHub Release, and demo sync.
- Do not edit GitHub Release notes independently from the repo-managed release files.

Recommended GitHub Actions flow:

1. Commit the release fragments on `main`.
2. Run the `Release Prepare` workflow with the target version. It opens a generated release PR from `release/vX.Y.Z`.
3. Review and merge that release PR. Merging is the maintainer approval gate.
4. The merged `release/vX.Y.Z` PR automatically triggers `Release Publish`, which tags the merge commit, creates the GitHub Release, and syncs the public demo from the released tag with the production demo-sync flow.
5. Use the manual `Release Publish` workflow only as a fallback if the automatic merge-triggered publish path needs to be rerun or repaired.

Demo-sync workflow secrets:

- `DEMO_SHEET_OAUTH_CLIENT_JSON`
- `DEMO_SHEET_OAUTH_TOKEN_JSON`
- `CLASP_RC_JSON` from the maintainer `clasp` login JSON that matches `.demo-sheet.local/production/.clasprc.json` locally

The demo-sync job keeps those secret values out of the checked-out workspace and off the runner filesystem by exposing them through shell-owned file descriptors for the duration of the sync step. The OAuth token is treated as read-only in CI, so refreshes must be handled by updating the stored secret. All three secret values must be valid JSON.

Maintainer release checklist:

1. Review pending fragments under [`changes.d/`](./changes.d/) and make sure each user-visible change is covered once, with end-user wording.
2. Optional: run `npm run release:check-fragments`.
3. Optional: run any extra smoke checks beyond the built-in `prepare` verification gate.
4. Run the `Release Prepare` workflow for `x.y.z`, or make sure the git worktree is clean and run `npm run release:prepare -- x.y.z`.
5. Inspect the meaningful generated release artifacts:
   [version.properties](./version.properties),
   [`docs/release-notes/vX.Y.Z.md`](./docs/release-notes/),
   and [`docs/release-notes/RELEASE_NOTES.md`](./docs/release-notes/RELEASE_NOTES.md).
6. Merge the release PR, or if you used the local fallback, commit the reviewed release changes, for example `git commit -m "Release v0.9.0"`.
7. Confirm that `Release Publish` ran for the merged release PR and completed both jobs:
   the publish job and the demo-sync job.

If the change affects exchange coverage or source support, regenerate [`website/docs/support-matrix.md`](./website/docs/support-matrix.md) with `npm run support-matrix -- --update-page`.
