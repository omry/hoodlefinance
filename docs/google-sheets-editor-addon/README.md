# Google Sheets Editor Add-on Prototype

This folder holds an experimental prototype for a Google Sheets Editor add-on version of `HOODLEFINANCE`.

It does not replace the current public install path yet. The current supported install flow is still the manual bound-script flow documented in [`README.md`](../../README.md) and [`website/docs/api/overview.md`](../../website/docs/api/overview.md).

What this prototype includes:

- a Sheets add-on homepage function in [`hoodlefinance.js`](../../hoodlefinance.js)
- an `onInstall()` hook that reuses the normal menu bootstrap
- a sample [`appsscript.json`](./appsscript.json) manifest for a Sheets-only Editor add-on project that can be used as a starting point for Marketplace packaging work
- a packaging and runtime review in [`marketplace-evaluation.md`](./marketplace-evaluation.md)
- a step-by-step Marketplace readiness checklist in [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md)
- an OAuth-review prep note in [`oauth-review-prep.md`](./oauth-review-prep.md)
- an OAuth-review submission checklist in [`oauth-review-checklist.md`](./oauth-review-checklist.md)

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
- the `Enable` menu item appeared and worked from the add-on menu

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

- prepare the OAuth verification and review material needed for a public Marketplace submission
- capture or record the short demo video Google may request during OAuth review
- submit for review when the OAuth package is ready

For the step-by-step execution path, use [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md). For the final pre-submission gate, use [`oauth-review-checklist.md`](./oauth-review-checklist.md).

## Marketplace Listing Assets

The shared source tree and generation workflow now live in [`assets/README.md`](../../assets/README.md).

## Maintainer Deployment Automation

The repo now includes a maintainer-only `clasp` deployment helper for the add-on script project, with separate staging and production targets.

```sh
npm run addon:deploy:production:dry-run
```

Before using it for a real push:

For production:

1. Copy [`addon-deploy-target.example.json`](./addon-deploy-target.example.json) to:

```text
.addon-deploy.local/production/target.json
```

2. Set the target `scriptId` in that local file.
3. Download the OAuth client JSON for the add-on deployment Google Cloud project and save it at:

```text
.addon-deploy.local/production/oauth-client.json
```

4. Log in with that OAuth client so `clasp` writes the ignored repo-local auth file:

```sh
npm exec -- clasp -A .addon-deploy.local/production/.clasprc.json login --creds .addon-deploy.local/production/oauth-client.json
```

5. Confirm that `clasp` created the ignored repo-local auth file at `.addon-deploy.local/production/.clasprc.json`, and that it belongs to the Google account that can edit the target Apps Script project.

For staging, use the same file names under `.addon-deploy.local/staging/` and run:

```sh
npm run addon:deploy -- --staging --dry-run
```

The production deploy flow still accepts the old root-level files under `.addon-deploy.local/` as legacy aliases during local migration, but the new canonical production layout is `.addon-deploy.local/production/`.

If you prefer `npm run`, use either:

```sh
npm run addon:deploy:production:dry-run
npm run addon:deploy:staging:dry-run
```

If you prefer passing flags manually through `npm run`, keep the target explicit and do not omit the `--` separator:

```sh
npm run addon:deploy -- --production --dry-run
npm run addon:deploy -- --staging --dry-run
```

Keep the add-on project and demo-sync OAuth project separate. The public-review Marketplace setup belongs in `HoodleFinance Add-on Public`, while the desktop OAuth client for `tools/demo/sync.js` should live in `HoodleFinance Demo Sheets`.

You can confirm which `clasp` account the add-on deploy flows will use, alongside the staging and production demo auth slots, with:

```sh
npm run clasp:user
```

The tracked deployment layout lives in [`addon-deploy-layout.json`](./addon-deploy-layout.json). Right now it deploys [`hoodlefinance.js`](../../hoodlefinance.js) plus the add-on manifest at [`appsscript.json`](./appsscript.json). If the add-on source is later split across multiple script files, update the tracked `sourceFiles` list there rather than hardcoding those paths into the deployment tool.

By default, the deploy helper:

- prepares a temporary `clasp` worktree under `.addon-deploy.local/<target>/`
- pushes the configured manifest and source files to the target script project
- creates a new Apps Script version and prints that version number for Marketplace use
- injects a generated staging marker only for `--staging` deploys so staging installs are visibly labeled in the add-on UI without changing custom function names

Use `--push-only` if you want to sync source without creating a new version.
