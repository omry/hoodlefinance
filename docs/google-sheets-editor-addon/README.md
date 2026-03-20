# Google Sheets Editor Add-on Prototype

This folder holds an experimental prototype for a Google Sheets Editor add-on version of `HOODLEFINANCE`.

It does not replace the current public install path yet. The current supported install flow is still the manual bound-script flow documented in [`README.md`](../../README.md) and [`docs/hoodlefinance-api.md`](../hoodlefinance-api.md).

What this prototype includes:

- a Sheets add-on homepage function in [`hoodlefinance.js`](../../hoodlefinance.js)
- an `onInstall()` hook that reuses the normal menu bootstrap
- a sample [`appsscript.json`](./appsscript.json) manifest for a Sheets-only Editor add-on project that can be used as a starting point for Marketplace packaging work

## Manual Test Finding

On March 21, 2026, manual testing of the unpublished Editor add-on test deployment showed:

- the add-on loaded into Sheets and menu actions ran
- version-reporting menu actions worked after authorization
- custom functions were still reported by Sheets as `Unknown function`
- the same `Unknown function` result reproduced with a minimal `TEST_PING()` custom function, a reduced manifest, and an incognito single-account browser session
- the behavior appears consistent with the public Google issue tracker report at https://issuetracker.google.com/issues/36763437?pli=1

## Notes

- This is a prototype scaffold, not a published Marketplace package.
- Apps Script test deployments were sufficient for menu-level validation, but did not verify custom-function exposure in Sheets.
- Marketplace packaging is the next meaningful validation path for this prototype.
- Scope review, branding, publishing metadata, OAuth consent, and distribution are still follow-up work.
- The runtime behavior of the custom functions is still subject to the same Apps Script execution and fetch limits described in [`docs/design/google-sheets-deployment-strategy.md`](../design/google-sheets-deployment-strategy.md).
