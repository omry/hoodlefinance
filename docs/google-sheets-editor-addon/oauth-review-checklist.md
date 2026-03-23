# OAuth Review Submission Checklist

This checklist turns the broader notes in [`oauth-review-prep.md`](./oauth-review-prep.md) and [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md) into a concrete pre-submission tracker.

Use it right before filing for OAuth review.

## Done

- [X] Dedicated standard Google Cloud project created for the add-on
- [X] Apps Script project linked to that Cloud project
- [X] Marketplace SDK listing configured and validated for a private install
- [X] OAuth consent configured for the linked Cloud project
- [X] Private Marketplace dry run succeeded
- [X] `HOODLEFINANCE()` is recognized in Sheets from the Marketplace-installed add-on
- [X] Add-on homepage loads successfully
- [X] Add-on menu appears under `Extensions`
- [X] `Show installed version` works from the installed add-on
- [X] Representative formulas returned data successfully in the private dry run
- [X] Public support page exists:
  https://hoodlefinance.com/support
- [X] Public privacy policy exists:
  https://hoodlefinance.com/privacy-policy
- [X] Public terms of service exists:
  https://hoodlefinance.com/terms-of-service
- [X] Public support email now receives mail at `support@hoodlefinance.com`
- [X] Listing text, icons, banner, and screenshot assets exist
- [X] Scope justifications are documented in [`oauth-review-prep.md`](./oauth-review-prep.md)
- [X] Separate public-review Cloud project created:
  - name: `HoodleFinance Add-on Public`
  - id: `hoodlefinance-addon-public`
- [X] Public-review OAuth branding configured
- [X] Public-review OAuth audience set to `External` with `omry@falcon.yadan.net` added as a test user
- [X] Current public-review OAuth data-access view shows:
  - `spreadsheets.currentonly` as non-sensitive
  - `script.container.ui` as sensitive
  - `script.external_request` as sensitive
  - no restricted scopes
- [X] `userinfo.email` and `userinfo.profile` are not currently appearing in the public-review OAuth data-access view
- [X] Public-review Marketplace installation mode chosen:
  - `Individual + Admin Install`
- [X] Public-review Apps Script target chosen for the add-on code push path
- [X] Code push to the public-review add-on Apps Script project succeeded:
  - `npm exec -- node tools/deploy-addon.js --push-only`
  - pull-back verification confirmed both `hoodlefinance.js` and `appsscript.json` on the remote script project

## Remaining

- [ ] Create the new public Marketplace app for the OAuth review submission path:
  - the current Marketplace app was saved as `Private`
  - App Visibility cannot be changed after it is saved
  - keep the current private app for internal testing if it is still useful
- [ ] Create and choose the public-review Apps Script version that should back the public Marketplace app
- [ ] Reconfirm the final submitted scope set matches across:
  - Apps Script manifest
  - OAuth consent screen
  - Marketplace configuration
- [ ] Recheck `userinfo.email` and `userinfo.profile` after the public Marketplace app is fully configured:
  - current public-review OAuth observation: they are not appearing in the Data Access view
  - old private-app observation: removing them from the consent / Marketplace surface made them reappear after refresh
  - contrast: removing `https://www.googleapis.com/auth/script.container.ui` did not make it reappear
  - be ready to explain `userinfo.email` and `userinfo.profile` as Google-managed consent-surface scopes only if they reappear in the final public app path
- [ ] Prepare the short reviewer explanation for the identity scopes:
  - only needed if `userinfo.email` and `userinfo.profile` reappear in the final public app path
  - if they do, describe them as Google-managed consent items rather than intentionally used runtime scopes
- [ ] Prepare the reviewer explanation for each intentional scope:
  - `script.container.ui`
  - `script.external_request`
  - `spreadsheets.currentonly`
- [ ] Reconfirm `urlFetchWhitelist` and `openLinkUrlPrefixes` still match actual runtime behavior in [`appsscript.json`](./appsscript.json)
- [ ] Final-review the listing for wording consistency across:
  - app name
  - short description
  - detailed description
  - category
  - support/privacy/terms links
  - screenshots and banner
- [ ] Replace any remaining prototype or placeholder branding in the listing / manifest surface
- [ ] Record the short demo video likely needed for OAuth verification:
  - install flow
  - add-on homepage
  - menu entry point
  - one or two representative formulas working in Sheets
- [ ] Re-run one clean install from the new public review app before submission and confirm the install path still works end to end:
  - homepage loads
  - menu appears
  - `HOODLEFINANCE()` is recognized
  - representative formulas work
- [ ] Submit for OAuth review once the package above is ready

## Blocked Or Open Questions

- [ ] Decide whether the current support, privacy, and terms wording is final enough for public review or needs one more pass
- [ ] Decide how much to invest in the Marketplace path before broader product questions are settled:
  - manual install vs Marketplace positioning
  - same-spreadsheet conflict handling
  - source / policy / commercialization risk

## Submission Gate

Do not file for OAuth review until:

- the final scope set is stable
- the listing and policy surface are final
- the demo video is ready
- one last validation pass on the new public review app succeeds
