# Marketplace Readiness Checklist

This checklist is the practical follow-up to [`marketplace-evaluation.md`](./marketplace-evaluation.md).

Its purpose is now broader than the original private dry run:

- preserve the successful private Marketplace validation
- stand up the separate public-review project and listing path
- finish the listing and policy surface
- prepare the add-on for public Marketplace review

## Current Status

Already done:

- Google Workspace account created
- `falcon.yadan.net` chosen as the dedicated Workspace/testing domain
- Gmail configured for `falcon.yadan.net`
- MX updated for the Workspace subdomain
- DKIM configured
- dedicated Cloud project created:
  - name: `hoodlefinance-sheets-addon`
  - id: `hoodlefinance-sheets-addon`
  - number: `221506477564`
- separate public-review Cloud project created:
  - name: `HoodleFinance Add-on Public`
  - id: `hoodlefinance-addon-public`
- dedicated Apps Script project created and linked to the standard Cloud project
- Marketplace SDK listing configured
- private install completed
- `HOODLEFINANCE()` recognized in Sheets from the Marketplace-installed add-on
- the add-on homepage loaded successfully
- the add-on menu appeared under `Extensions`
- `Show installed version` worked from the add-on menu
- representative formulas returned data successfully
- public support email now receives mail at `support@hoodlefinance.com`
- decision made to proceed toward public Marketplace review

Current next step:

- decide the Apps Script deployment/version for the public-review app, finish the public-review Marketplace configuration in the new public project, and then repeat the install validation there before submission

## 1. Cloud Project And Script Wiring

- Keep the private validated path and the public-review path separate.
- Use a dedicated standard Google Cloud project for the current private/staging add-on.
- Use a separate dedicated standard Google Cloud project for the public-review submission path.
- Keep the Apps Script project and Marketplace listing tied to the intended script ID and version for each path.

Checklist:

- [X] Cloud project created
- [X] Separate public-review Cloud project created
- [X] Apps Script project linked to the dedicated standard Cloud project
- [X] Script ID recorded
- [ ] Public-review Marketplace listing points at the intended script project and version

## 2. Manifest And Runtime Surface

Use [`appsscript.json`](./appsscript.json) as the baseline manifest and keep it aligned with actual runtime behavior.

Manifest notes:

- keep `urlFetchWhitelist` aligned with the actual fetch targets used by the add-on
- keep `openLinkUrlPrefixes` aligned with the actual external links opened by the add-on
- remove unused library references
- do not add extra scopes beyond what the code and manifest currently need
- keep the manifest as narrow as practical

Checklist:

- [X] Manifest reset to the clean baseline
- [X] Required fetch and open-link allowlists are present
- [X] Runtime behavior validated through Marketplace install

## 3. OAuth And Marketplace Configuration

- Keep the OAuth consent screen configured for the linked Cloud project.
- Keep the Marketplace SDK configuration aligned with the current add-on shape.
- Treat the old private Marketplace app as validation/staging only.
- Build the real submission path in the new public-review project.
- Before public submission, make sure the consent and listing surface are consistent enough for review.

Checklist:

- [X] OAuth consent configured
- [X] Marketplace SDK enabled
- [X] Listing configuration works for private install
- [X] Marketplace listing reviewed end to end
- [X] Public-review Cloud project created
- [X] Public-review OAuth branding configured
- [X] Public-review OAuth audience set to `External` with a test user
- [X] Public-review Marketplace installation mode chosen:
  - `Individual + Admin Install`
- [X] Current scope classification observed in the public-review OAuth path:
  - `spreadsheets.currentonly` shown as non-sensitive
  - `script.container.ui` shown as sensitive
  - `script.external_request` shown as sensitive
  - no restricted scopes shown
- [X] `userinfo.email` and `userinfo.profile` are not currently appearing in the public-review OAuth data-access view
- [ ] Public-review Apps Script deployment/version chosen
- [ ] Public-review Marketplace configuration completed
- [ ] Public-review OAuth requirements fully prepared

## 4. Listing Material

Maintain the public-facing listing surface:

- app name
- short description
- detailed description
- category
- support link
- privacy policy link
- terms of service link
- icon assets and screenshot(s)

Canonical policy/support pages are now hosted on the project website:

- https://hoodlefinance.com/support
- https://hoodlefinance.com/privacy-policy
- https://hoodlefinance.com/terms-of-service
- [`oauth-review-prep.md`](./oauth-review-prep.md)

Checklist:

- [X] Listing text prepared
- [X] Support/privacy/terms links prepared
- [X] Public support email updated to `support@hoodlefinance.com`
- [X] Required visual assets prepared
- [X] Final public-facing wording reviewed

## 5. Private Validation Result

The private Marketplace validation already answered the main technical question.

Observed result on March 21, 2026:

- Marketplace packaging made `HOODLEFINANCE()` discoverable in Sheets
- the add-on homepage loaded successfully
- the add-on menu appeared under `Extensions`
- `Show installed version` worked from the installed add-on
- representative formulas returned data successfully

Checklist:

- [X] Private Marketplace install succeeded
- [X] Custom functions are recognized by Sheets
- [X] Add-on UI entry points work

## 6. Public Review Readiness

This is the remaining gate after the successful private validation.

Focus areas:

- completion of the new public-review Marketplace path
- listing quality and consistency
- policy/support-link stability
- OAuth-review preparation
- comfort with source and policy risk before public submission

Checklist:

- [X] Decide to proceed toward public Marketplace review
- [ ] Finish the new public-review Marketplace app configuration
- [ ] Re-run install validation through the new public-review app path
- [ ] Prepare any required OAuth verification material
- [ ] Submit for public review when ready

## Notes For This Setup

- `falcon.yadan.net` is being used as a dedicated Workspace/testing domain.
- The checklist does not assume Gmail becomes the mail host for `yadan.net`.
- Google One storage and Google Workspace storage should be treated as separate concerns for this effort.

## Official References

- https://developers.google.com/apps-script/guides/cloud-platform-projects
- https://developers.google.com/apps-script/concepts/deployments
- https://developers.google.com/workspace/add-ons/how-tos/publish-add-on-overview
- https://developers.google.com/workspace/marketplace/enable-configure-sdk
- https://developers.google.com/workspace/marketplace/configure-oauth-consent-screen
- https://developers.google.com/workspace/marketplace/create-listing
