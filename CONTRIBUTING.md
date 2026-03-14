# Contributing to hoodlefinance

This is a small Apps Script project with a Node-based local test harness.

The codebase is intentionally simple:

- [`hoodlefinance.js`](./hoodlefinance.js): main Apps Script implementation
- [`test/hoodlefinance.test.js`](./test/hoodlefinance.test.js): Node unit tests
- [`tools/cli.js`](./tools/cli.js): local smoke-test wrapper
- [`tools/sync-demo-sheet.js`](./tools/sync-demo-sheet.js): public demo sheet sync tool
- [`tools/generate-support-matrix.py`](./tools/generate-support-matrix.py): support matrix generator
- [`support-matrix.md`](./support-matrix.md): generated exchange coverage matrix
- [`docs/demo-sheet/`](./docs/demo-sheet/): tracked demo sheet config and TSV tab data
- [`hoodlefinance-api.md`](./hoodlefinance-api.md): detailed user-facing reference

## License

This project should be treated as MIT-licensed.

If you are contributing changes, keep that in mind for any external code, copied snippets, or bundled assets you introduce.

## Local Testing

Run the unit tests:

```sh
node --test test/hoodlefinance.test.js
node --test test/sync-demo-sheet.test.js
```

Run syntax checks:

```sh
node --check hoodlefinance.js
node --check test/hoodlefinance.test.js
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

Run the live benchmark for scalar-vs-range performance:

```sh
node tools/benchmark.js
node tools/benchmark.js --attribute price --count 50
node tools/benchmark.js --tickers GOOG,AAPL,MSFT,AMZN,META
```

The CLI loads the Apps Script source into a local VM and proxies `UrlFetchApp.fetch()` through the local Node HTTP transport, so it is useful for checking live endpoints without pasting into Google Sheets.

Sync the public demo sheet:

```sh
node tools/sync-demo-sheet.js --dry-run
node tools/sync-demo-sheet.js
```

Before the live sync will work, set up:

- Google OAuth desktop-app credentials at `.demo-sheet.local/oauth-client.json`
- `clasp` installed from npm and authenticated:

```sh
npm install -g @google/clasp
clasp login --no-localhost
```

The sync tool treats [`docs/demo-sheet/demo-sheet.json`](./docs/demo-sheet/demo-sheet.json) and the TSV files under [`docs/demo-sheet/`](./docs/demo-sheet/) as the source of truth for the demo sheet's structure and visible content. It writes local-only OAuth tokens and temporary clasp files under `.demo-sheet.local/`, which must stay untracked.

For the high-level process for adding another trusted demo maintainer, see [`docs/demo-sheet/README.md`](./docs/demo-sheet/README.md).

Generate the support matrix from live CLI probes:

```sh
python3 tools/generate-support-matrix.py
python3 tools/generate-support-matrix.py --details
python3 tools/generate-support-matrix.py --update-page
```

The generator is intentionally user-facing: it reports exchange coverage for the features a normal user calls, not the backend-specific helper attributes. It also contains a small reliability override map for combinations that are known to be flaky in practice. Use that map for long-term stability issues; do not rely on a single successful run to promote a fragile combination to stable support.

## Contribution Expectations

Changes should usually include:

1. Unit tests for any new parsing, routing, or normalization logic.
2. Documentation updates in [`hoodlefinance-api.md`](./hoodlefinance-api.md) and, when appropriate, [`README.md`](./README.md).
3. Live CLI checks for any source-backed change, especially new ISIN resolvers.
4. A version bump in `HOODLEFINANCE_VERSION_` for substantive user-facing changes.
5. Demo-sheet TSV and config updates when the public demo should reflect the new behavior.

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

If the change affects exchange coverage or source support, regenerate [`support-matrix.md`](./support-matrix.md) with `python3 tools/generate-support-matrix.py --update-page`.

If the change affects the public demo examples, refresh the demo sheet with `node tools/sync-demo-sheet.js`.
