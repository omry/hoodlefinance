# Google Sheets Editor Add-on Prototype

This folder holds an experimental prototype for a Google Sheets Editor add-on version of `HOODLEFINANCE`.

It does not replace the current public install path yet. The current supported install flow is still the manual bound-script flow documented in [`README.md`](../../README.md) and [`docs/hoodlefinance-api.md`](../hoodlefinance-api.md).

What this prototype includes:

- a Sheets add-on homepage function in [`hoodlefinance.js`](../../hoodlefinance.js)
- an `onInstall()` hook that reuses the normal menu bootstrap
- a sample [`appsscript.json`](./appsscript.json) manifest for a Sheets-only Editor add-on project that can be used as a starting point for Marketplace packaging work
- a packaging and runtime review in [`marketplace-evaluation.md`](./marketplace-evaluation.md)
- a step-by-step Marketplace readiness checklist in [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md)

## Manual Test Finding

On March 21, 2026, manual testing of the unpublished Editor add-on test deployment showed:

- the add-on loaded into Sheets and menu actions ran
- version-reporting menu actions worked after authorization
- custom functions were still reported by Sheets as `Unknown function`
- the same `Unknown function` result reproduced with a minimal `TEST_PING()` custom function, a reduced manifest, and an incognito single-account browser session
- the behavior appears consistent with the public Google issue tracker report at https://issuetracker.google.com/issues/36763437?pli=1

## Private Marketplace Dry-Run Finding

Later on March 21, 2026, a private internal Google Workspace Marketplace dry run showed:

- the Marketplace-installed add-on exposed `HOODLEFINANCE()` in Sheets
- the add-on menu appeared under `Extensions`
- `Show installed version` worked from the add-on menu

This answered the main product question that unpublished Apps Script test deployments could not answer: Marketplace packaging can make the custom functions discoverable in Sheets.

## Current State

- This is still a prototype scaffold, not a public Marketplace release.
- Apps Script test deployments were sufficient for menu-level validation, but did not verify custom-function exposure in Sheets.
- The private Marketplace dry run now validates that Marketplace packaging can expose the custom functions in Sheets.
- Google's current Editor add-on docs say unpublished test deployments run `onOpen()` in `AuthMode.LIMITED`, while only published add-ons run `onOpen()` in `AuthMode.NONE`. That means the unpublished manual test does not fully validate publish-time menu behavior.
- The current prototype now uses the Editor add-on menu path and skips the bound-script-style automatic raw-source update check during add-on `onOpen()`, including published `AuthMode.NONE` cases.
- Listing assets, policy pages, and support links now exist, but public-review readiness is still follow-up work. See [`marketplace-evaluation.md`](./marketplace-evaluation.md) for the broader design/status view and [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md) for the actual execution checklist.
- The runtime behavior of the custom functions is still subject to the same Apps Script execution and fetch limits described in [`docs/design/google-sheets-deployment-strategy.md`](../design/google-sheets-deployment-strategy.md).

## Next Steps

- finish the final public-facing listing polish
- prepare the OAuth verification and review material needed for a public Marketplace submission
- review the public listing end to end, then submit when ready

For the step-by-step execution path, use [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md).
