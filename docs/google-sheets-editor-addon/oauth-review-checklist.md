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
- [X] Listing text, icons, banner, and screenshot assets exist
- [X] Scope justifications are documented in [`oauth-review-prep.md`](./oauth-review-prep.md)

## Remaining

- [ ] Reconfirm the final submitted scope set matches across:
  - Apps Script manifest
  - OAuth consent screen
  - Marketplace configuration
- [ ] Recheck whether `userinfo.email` and `userinfo.profile` are still injected by Google during the Marketplace / OAuth flow
- [ ] Prepare the short reviewer explanation for the identity scopes:
  - Google-managed consent items
  - not intentionally used by add-on runtime logic
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
- [ ] Update public-facing support and contact emails to use the `hoodlefinance.com` domain where they appear in the listing, policies, or support surface
- [ ] Replace any remaining prototype or placeholder branding in the listing / manifest surface
- [ ] Record the short demo video likely needed for OAuth verification:
  - install flow
  - add-on homepage
  - menu entry point
  - one or two representative formulas working in Sheets
- [ ] Re-run one clean private Marketplace install before submission
- [ ] Reconfirm the final validation path still works:
  - homepage loads
  - menu appears
  - `HOODLEFINANCE()` is recognized
  - representative formulas work
- [ ] Submit for OAuth review once the package above is ready

## Blocked Or Open Questions

- [ ] Confirm whether Google still treats `userinfo.email` and `userinfo.profile` as unavoidable Marketplace / consent-surface scopes for this install path
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
- one last private Marketplace validation pass succeeds
