# OAuth Review Submission Checklist

This checklist turns the broader notes in [`oauth-review-prep.md`](./oauth-review-prep.md) and [`marketplace-readiness-checklist.md`](./marketplace-readiness-checklist.md) into a concrete pre-submission tracker.

Use it right before filing for OAuth review.

Repo-local refresh on March 24, 2026:

- the public-review Marketplace app path is in place
- the clean public-review install path has already been revalidated
- the remaining work is now the final Google-side scope/listing check, branding polish, and the reviewer package

## Done

- [x] Dedicated standard Google Cloud project created for the add-on
- [x] Apps Script project linked to that Cloud project
- [x] Marketplace SDK listing configured and validated for a private install
- [x] OAuth consent configured for the linked Cloud project
- [x] Private Marketplace dry run succeeded
- [x] `HOODLEFINANCE()` is recognized in Sheets from the Marketplace-installed add-on
- [x] Add-on homepage loads successfully
- [x] Add-on menu appears under `Extensions`
- [x] The `Enable` menu item appears and works from the installed add-on
- [x] Representative formulas returned data successfully in the private dry run
- [x] Public support page exists:
      https://hoodlefinance.com/support
- [x] Public privacy policy exists:
      https://hoodlefinance.com/privacy-policy
- [x] Public terms of service exists:
      https://hoodlefinance.com/terms-of-service
- [x] Public support email now receives mail at `support@hoodlefinance.com`
- [x] Listing text, icons, banner, and screenshot assets exist
- [x] Scope justifications are documented in [`oauth-review-prep.md`](./oauth-review-prep.md)
- [x] Separate public-review Cloud project created:
  - name: `HoodleFinance Public`
  - id: `hoodlefinance-public`
  - number: `826310867331`
- [x] Public-review OAuth branding configured
- [x] Public-review OAuth audience set to `External` with `omry@falcon.yadan.net` added as a test user
- [x] Repo-local manifest scope set remains:
  - `script.external_request`
  - `spreadsheets.currentonly`
- [x] `userinfo.email` and `userinfo.profile` are not currently appearing in the public-review OAuth data-access view
- [x] Public-review Marketplace installation mode chosen:
  - `Individual + Admin Install`
- [x] Public-review Apps Script target chosen for the add-on code push path
- [x] Code push to the public-review add-on Apps Script project succeeded:
  - `npm run addon:deploy -- --production --push-only`
  - pull-back verification confirmed both `hoodlefinance.js` and `appsscript.json` on the remote script project
- [x] Fresh public-review Apps Script project created and linked:
  - name: `HoodleFinance Public`
  - script ID: `1zB8ohVlbARtuJeNJhdLX0_xnIm9MNlslfdh0z0-OjcNcC3yKrmBNLPrW`
- [x] Active Sheets add-on deployment created for the public-review Apps Script project
- [x] Public-review Marketplace draft install now works end to end:
  - homepage loads
  - menu appears
  - the `Enable` menu item appears and works
  - `HOODLEFINANCE()` is recognized
- [x] Root cause of the earlier broken public draft install identified and fixed:
  - the first Marketplace-installed `onOpen()` ran in a low-auth mode
  - `getInstallationSource()` and `getUserProperties()` were not available there
  - add-on detection was hardened so the add-on menu path still initializes safely
- [x] New public Marketplace app created for the OAuth review submission path
- [x] Public-review Apps Script version created and chosen for the public Marketplace app
- [x] Reviewer explanation for each intentional scope is documented in [`oauth-review-prep.md`](./oauth-review-prep.md)
- [x] Reviewer explanation for `userinfo.email` and `userinfo.profile` is drafted if they reappear:
  - treat them as Google-managed consent items rather than intentionally requested runtime scopes
- [x] `urlFetchWhitelist` and `openLinkUrlPrefixes` in [`appsscript.json`](./appsscript.json) still match the repo's current add-on runtime surface:
  - fetch allowlist covers the GitHub raw, IBKR, Ariva, LSE, TradingView, PSE, Google Finance, and Yahoo endpoints referenced in [`hoodlefinance.js`](../../hoodlefinance.js)
  - open-link allowlist covers the GitHub and `hoodlefinance.com` links exposed by the current add-on UI surface
- [x] Manifest branding placeholder replaced in [`appsscript.json`](./appsscript.json):
  - `logoUrl` now points at the project-hosted HoodleFinance icon instead of the generic Google-hosted functions icon
- [x] Re-run one clean install from the new public review app before submission and confirm the install path still works end to end:
  - homepage loads
  - menu appears
  - `HOODLEFINANCE()` is recognized
  - representative formulas work

## Remaining

- [x] Do one final Google-side scope consistency check immediately before submission:
  - Apps Script manifest still declares only `script.external_request` and `spreadsheets.currentonly`
  - OAuth consent screen matches that final submitted scope set
  - Marketplace configuration matches that final submitted scope set
- [x] Treat `userinfo.email` and `userinfo.profile` as Google-managed default consent items rather than a repo-controlled scope decision:
  - they are not part of the repo-local manifest scope set
  - if they appear in the public-review OAuth Data Access view, explain them as default Google-managed consent-surface items rather than intentionally requested runtime scopes
- [ ] Final-review the listing for wording consistency across:
  - app name
  - short description
  - detailed description
  - category
  - support/privacy/terms links
  - screenshots and banner
- [ ] Record the short demo video likely needed for OAuth verification:
  - install flow
  - add-on homepage
  - menu entry point
  - one or two representative formulas working in Sheets
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
