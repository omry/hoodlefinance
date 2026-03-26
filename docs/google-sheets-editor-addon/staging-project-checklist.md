# Add-on Staging Project Checklist

This checklist is for standing up a dedicated Google Cloud and Apps Script path for the staging Sheets add-on target.

Goal for this path:

- keep staging isolated from the production add-on project
- keep the repo-local staging deploy flow under `.addon-deploy.local/staging/`
- prefer a public-facing Google Cloud project configuration that stays in OAuth `Testing` and is used only by explicitly-added test users
- avoid accidentally turning this staging path into the public-review submission path

Known input from the current setup attempt:

- project name: `HoodleFinance Staging`
- project ID: `hoodlefinance-staging`
- project number: `707977685800`

Important observation:

- this no longer matches the older private/staging add-on project recorded in [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md)
- treat this as the current candidate staging project unless a later console step shows otherwise

## 1. Decide Whether This Is A New Project Or A Rename

- [X] Confirmed this is not reusing the older private/staging project number
- [X] Current staging project metadata recorded
- [X] Record the current staging project metadata here:
  - project name: `HoodleFinance Staging`
  - project ID: `hoodlefinance-staging`
  - project number: `707977685800`

- [X] `HoodleFinance Staging` / `hoodlefinance-staging` / `707977685800` is the canonical staging project for the add-on staging flow

## 2. Decide The Staging Distribution Model

- [X] For the minimal staging test path, start with unpublished Apps Script test deployments only
- [X] The intent is "no review, only explicit testers," so keep the OAuth consent screen in `Testing`
- [X] Do not use the staging project for Google review or public Marketplace submission; staging updates should stay on the no-review test path
- [X] Staging and production may both be installed for the same user, but only one enabled add-on at a time is a supported validation setup
- [X] Any spreadsheet can be used for staging add-on testing; a separate tester browser profile is not required

Important note from Google's current docs:

- Google says Marketplace app visibility is permanent once saved as public or private
- Google also says a public Marketplace app goes through review before publication

Current conclusion:

- the minimal no-review staging path is unpublished Apps Script test deployments
- this avoids Marketplace configuration and review concerns for the first staging loop
- if later we need the closest production-like install flow, add Marketplace draft installs as a second phase rather than as the initial requirement

Open questions:

- [X] Add Marketplace draft installs now as the second-phase staging check, after the unpublished Apps Script test deployment path is working

## 3. Enable The Minimum Google Services

- [X] Enable the Apps Script API in the staging Cloud project
- [X] Enable the Google Workspace Marketplace SDK if staging will exercise Marketplace installs
- [X] Enable any additional Google APIs only if the staging project setup actually needs them

Staging uses the same tracked manifest as production, from [`appsscript.json`](./appsscript.json):

- current add-on OAuth scopes:
  - `https://www.googleapis.com/auth/script.external_request`
  - `https://www.googleapis.com/auth/spreadsheets.currentonly`

- [X] Staging uses the same repo code and manifest surface as production, so keep the staging project aligned with the current tracked manifest rather than inventing a staging-only scope set

## 4. Create Or Link The Staging Apps Script Project

- [X] Decision made: staging will use a different Apps Script project from production
- [X] Dedicated staging Google Cloud project chosen and recorded at the top of this document
- [X] Dedicated staging Apps Script project created / confirmed for the add-on

- [X] Link that Apps Script project to the staging Google Cloud project
- [X] Record the staging script ID here:
  - script ID: `13WsAaizv0oo7OXaLIYsZYgbG-yxBhagbseV2EFAEjk8K4K169_EVnWyP`
  - Apps Script project name: `HoodleFinance Staging`
- [X] Confirm the staging Apps Script project is not the same script ID used by production
- [X] Add a staging-specific runtime marker so the installed add-on can identify itself clearly in menus, dialogs, or the homepage
  - implemented direction: `tools/deploy-addon.js` now injects a generated deploy-time staging marker file into the temporary Apps Script workdir
  - staging installs show the marker in the add-on enable menu item, homepage, installed-version dialog, and enable toast
  - production remains visually unmarked by default

- [ ] Decide whether to create the staging Apps Script project from scratch now or repurpose an existing non-production script project

## 5. Configure OAuth Consent For Test-User Use

- [ ] Configure the OAuth consent screen in the staging Cloud project
- [ ] Set the user type / audience to the external test-user path that stays in `Testing`
- [ ] Fill in the app name, support email, and developer contact email
- [ ] Add the intended tester accounts explicitly as OAuth test users
- [ ] Record the current tester list here:
  - test users:

Open questions:

- [ ] Which Google accounts should be included as the first staging test users?
- [ ] Do we want staging support/developer contact to match production, or stay clearly staging-specific?

## 6. Create Repo-Local Staging Deploy Credentials

- [ ] Download the staging desktop OAuth client JSON
- [ ] Save it at `.addon-deploy.local/staging/oauth-client.json`
- [ ] Create `.addon-deploy.local/staging/target.json` from [`addon-deploy-target.example.json`](./addon-deploy-target.example.json)
- [ ] Put the staging Apps Script `scriptId` into `.addon-deploy.local/staging/target.json`
- [ ] Generate the staging `clasp` auth file:

```sh
npm exec -- clasp -A .addon-deploy.local/staging/.clasprc.json login --creds .addon-deploy.local/staging/oauth-client.json
```

- [ ] Confirm `.addon-deploy.local/staging/.clasprc.json` now exists
- [ ] Confirm the authenticated Google account is the intended staging maintainer account

## 7. Verify Repo Tooling Against The Staging Target

- [ ] Run the staging auth inspection:

```sh
npm run clasp:user
```

- [ ] Run the staging deploy dry run:

```sh
npm run addon:deploy:staging:dry-run
```

- [ ] Confirm the dry run shows:
  - staging OAuth client path under `.addon-deploy.local/staging/`
  - staging `clasp` auth path under `.addon-deploy.local/staging/`
  - staging target config path under `.addon-deploy.local/staging/`

## 8. Do The First Real Staging Push

- [ ] Run the first real staging push:

```sh
npm run addon:deploy:staging
```

- [ ] Record the created Apps Script version here:
  - version:
- [ ] Confirm the remote Apps Script project now contains the expected `hoodlefinance.js` and add-on manifest

## 9. Choose The First Test Path

- [ ] If using unpublished Apps Script testing:
  - create or update a test deployment in Apps Script
  - install the add-on from `Deploy > Test deployments`
- [ ] If using Marketplace staging:
  - configure the Marketplace SDK against the staging script ID and version
  - keep the path clearly separated from the public-review project

Important note from Google's current docs:

- unpublished Apps Script add-ons can be installed for testing directly from Apps Script
- other testers need editor access to the script project for that unpublished test path

Open question:

- [ ] Is editor access on the Apps Script project acceptable for staging testers, or do we specifically need a Marketplace-based staging install path?

## 10. Validate Staging Identification In The UI

- [ ] Confirm the staging add-on can be distinguished from production when enabled in Sheets
- [ ] Verify the chosen staging marker appears in at least one user-visible surface:
  - add-on menu title
  - homepage card
  - installed version dialog
  - enable toast
- [ ] Confirm the staging marker comes from deploy-time configuration, not a manual post-deploy tweak

Open question:

- [ ] Which surface should be the canonical staging indicator for users:
  - menu title
  - homepage
  - version dialog
  - more than one?

## 11. Record The Outcome

- [ ] Confirm whether staging is now operational for:
  - local deploys
  - add-on installation
  - custom function recognition
  - menu/homepage behavior
- [ ] Note any Google-side blockers here:
  - blocker:

## Official References

- https://developers.google.com/workspace/marketplace/enable-configure-sdk
- https://developers.google.com/workspace/add-ons/how-tos/testing-workspace-addons
- https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons
- https://developers.google.com/workspace/add-ons/how-tos/publish-add-on-overview
