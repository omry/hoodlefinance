# Contributing to hoodlefinance

This is a small Apps Script project with a Node-based local test harness.

The codebase is intentionally simple:

- [`hoodlefinance.js`](./hoodlefinance.js): main Apps Script implementation
- [`hoodlefinance.test.js`](./hoodlefinance.test.js): Node unit tests
- [`cli.js`](./cli.js): local smoke-test wrapper
- [`hoodlefinance-api.md`](./hoodlefinance-api.md): detailed user-facing reference

## License

This project should be treated as MIT-licensed.

If you are contributing changes, keep that in mind for any external code, copied snippets, or bundled assets you introduce.

## Local Testing

Run the unit tests:

```sh
node --test hoodlefinance.test.js
```

Run syntax checks:

```sh
node --check hoodlefinance.js
node --check hoodlefinance.test.js
```

Run the CLI for live smoke tests:

```sh
node cli.js GOOG price
node cli.js GOOG isin
node cli.js ZPRX.DE isin
node cli.js PSE:BDO isin
```

The CLI loads the Apps Script source into a local VM and proxies `UrlFetchApp.fetch()` through `curl`, so it is useful for checking live endpoints without pasting into Google Sheets.

## Contribution Expectations

Changes should usually include:

1. Unit tests for any new parsing, routing, or normalization logic.
2. Documentation updates in [`hoodlefinance-api.md`](./hoodlefinance-api.md) and, when appropriate, [`README.md`](./README.md).
3. Live CLI checks for any source-backed change, especially new ISIN resolvers.

If a change adds a new source or exchange path, include both:

- fixture-based tests in `hoodlefinance.test.js`
- at least one real-world smoke-test example you actually verified

## What to Be Careful About

- Public endpoints are brittle. Prefer exact parsing of stable fields over loose scraping.
- For symbol-page sources, reject mismatches instead of silently accepting nearby results.
- Keep generic `isin` routing conservative. Only change defaults when coverage is strong enough to justify it.
- If a source is useful but not yet strong enough as a default, add it as an explicit attribute first.
- Preserve Apps Script compatibility. The main source file should stay usable when pasted directly into `Code.gs`.

## Documentation Rule

If behavior changes, the docs should change in the same PR/commit.

That includes:

- supported attributes
- exchange routing
- limitations
- examples

If the user-facing behavior changed and the docs did not, the change is incomplete.
