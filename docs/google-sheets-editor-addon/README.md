---
status: Active
updated: 2026-04-11
summary: Current add-on overview, maintenance notes, and deployment helper entrypoint.
---

# Google Sheets™ Editor Add-on

This folder holds the Google Sheets™ Editor add-on packaging, review notes, and deployment helpers for `HOODLEFINANCE`.

The public install path is the Google Workspace Marketplace™ add-on: [Install HoodleFinance](https://workspace.google.com/marketplace/app/hoodlefinance/826310867331). The manual bound-script flow is reserved for contributors and the tracked demo sheet.

What this folder includes:

- a Sheets add-on homepage function in [`hoodlefinance.js`](../../hoodlefinance.js)
- an `onInstall()` hook that reuses the normal menu bootstrap
- a sample [`appsscript.json`](./appsscript.json) manifest for a Sheets-only Editor add-on project that can be used as a starting point for Marketplace packaging work
- historical launch records:
  - [`marketplace-evaluation.md`](./marketplace-evaluation.md)
  - [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md)
  - [`oauth-review-prep.md`](./oauth-review-prep.md)
  - [`oauth-review-checklist.md`](./oauth-review-checklist.md)

This README is the current maintainer overview for the add-on. Treat the other markdown files in this folder as launch history unless they explicitly say otherwise.

## Manual Test Finding

On March 21, 2026, manual testing of the unpublished Editor add-on test deployment showed:

- the add-on loaded into Sheets and menu actions ran
- version-reporting menu actions worked after authorization
- custom functions were still reported by Sheets as `Unknown function`
- the same `Unknown function` result reproduced with a minimal `TEST_PING()` custom function, a reduced manifest, and an incognito single-account browser session
- the behavior appears consistent with the public Google issue tracker report at https://issuetracker.google.com/issues/36763437?pli=1

## Private Marketplace Dry-Run Finding

Later on March 21, 2026, a private internal Google Workspace Marketplace™ dry run showed:

- the Marketplace-installed add-on exposed `HOODLEFINANCE()` in Sheets
- the add-on menu appeared under `Extensions`
- the `Enable` menu item appeared and worked from the add-on menu

This answered the main product question that unpublished Apps Script™ test deployments could not answer: Marketplace packaging can make the custom functions discoverable in Sheets™.

## Current State

- The Google Workspace Marketplace™ release is the primary install path.
- Apps Script™ test deployments were sufficient for menu-level validation, but did not verify custom-function exposure in Sheets™.
- The private Marketplace dry run now validates that Marketplace packaging can expose the custom functions in Sheets.
- Google's current Editor add-on docs say unpublished test deployments run `onOpen()` in `AuthMode.LIMITED`, while only published add-ons run `onOpen()` in `AuthMode.NONE`. That means the unpublished manual test does not fully validate publish-time menu behavior.
- The current add-on code uses the Editor add-on menu path and skips the bound-script-style automatic raw-source update check during add-on `onOpen()`, including published `AuthMode.NONE` cases.
- Listing assets, policy pages, and support links now exist, and the remaining notes in this folder focus on rollout history, maintenance, and add-on-specific follow-up work. Use [`marketplace-evaluation.md`](./marketplace-evaluation.md) and [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md) as launch history rather than current operating guidance.
- The runtime behavior of the custom functions is still subject to the same Apps Script™ execution and fetch limits described in [`docs/design/deployment/google-sheets-deployment-strategy.md`](../design/deployment/google-sheets-deployment-strategy.md).

## Next Steps

- keep the Marketplace listing, support surface, and policy pages aligned with the live release
- keep the maintainer deployment helper and demo-sheet sync notes in sync with the production add-on
- record any post-launch migration or support follow-up notes in this folder

For rollout history, use [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md). For the OAuth-review record, use [`oauth-review-checklist.md`](./oauth-review-checklist.md).

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
3. Download the OAuth client JSON for the add-on deployment Google Cloud™ project and save it at:

```text
.addon-deploy.local/production/oauth-client.json
```

4. Log in with that OAuth client so `clasp` writes the ignored repo-local auth file:

```sh
npm exec -- clasp -A .addon-deploy.local/production/.clasprc.json login --creds .addon-deploy.local/production/oauth-client.json
```

5. Confirm that `clasp` created the ignored repo-local auth file at `.addon-deploy.local/production/.clasprc.json`, and that it belongs to the Google account that can edit the target Apps Script™ project.

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

The release workflow now deploys the production add-on version automatically and writes the created Apps Script version number to the GitHub Actions summary so it is easy to copy into the Marketplace SDK version field. It also warns when the Apps Script version history grows past 100 entries.

In GitHub Actions, the add-on deploy now uses its own `ADDON_DEPLOY_CLASP_RC_JSON` secret so it stays separate from the demo-sheet `clasp` auth.

Apps Script™ version cleanup is still a manual maintenance task in the Apps Script project history UI.

You can confirm which `clasp` account the add-on deploy flows will use, alongside the staging and production demo auth slots, with:

```sh
npm run clasp:user
```

The tracked deployment layout lives in [`addon-deploy-layout.json`](./addon-deploy-layout.json). Right now it deploys [`hoodlefinance.js`](../../hoodlefinance.js) plus the add-on manifest at [`appsscript.json`](./appsscript.json). If the add-on source is later split across multiple script files, update the tracked `sourceFiles` list there rather than hardcoding those paths into the deployment tool.

By default, the deploy helper:

- prepares a temporary `clasp` worktree under `.addon-deploy.local/<target>/`
- pushes the configured manifest and source files to the target script project
- creates a new Apps Script™ version and prints that version number for Marketplace use
- injects a generated staging marker only for `--staging` deploys so staging installs are visibly labeled in the add-on UI without changing custom function names

Use `--push-only` if you want to sync source without creating a new version.
