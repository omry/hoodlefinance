# Private Marketplace Dry-Run Checklist

This checklist is the practical follow-up to [`marketplace-evaluation.md`](./marketplace-evaluation.md).

Its purpose is simple:

- package the prototype as a private internal Google Workspace Marketplace app
- install it in a controlled environment
- answer the one blocking product question that local tests cannot answer: whether a Marketplace-installed add-on exposes `HOODLEFINANCE()` custom functions in Sheets

## Current Status

Already done for this dry run:

- Google Workspace account created
- `falcon.yadan.net` chosen as the dedicated Workspace/testing domain
- Gmail configured for `falcon.yadan.net`
- MX updated for the Workspace subdomain
- DKIM configured
- dedicated Cloud project created:
  - name: `hoodlefinance-sheets-addon`
  - id: `hoodlefinance-sheets-addon`
  - number: `221506477564`
- dedicated Apps Script project created and linked to the standard Cloud project
- Marketplace SDK draft listing configured
- private install completed
- `HOODLEFINANCE()` recognized in Sheets from the Marketplace-installed add-on
- `Show installed version` confirmed from the add-on menu

Current next step:

- finish the remaining listing and policy polish, record the dry-run outcome, and decide whether public review is worth pursuing

## Before You Start

- Use a Google Workspace account, not a personal `@gmail.com` account.
- For this dry run, use `falcon.yadan.net` as the Workspace domain.
- Domain verification is part of the setup.
- Keep the existing `yadan.net` mail flow on the current mail server.
- Treat `falcon.yadan.net` as a dedicated Workspace/testing identity, not as a mail-migration project.
- Use a dedicated standard Google Cloud project for this add-on.
- Assume this is an internal dry run, not a public launch.
- Keep notes as you go: script ID, Cloud project number, deployment version, test spreadsheet URL, and the exact formulas you tried.

For this repo, the Workspace/domain setup above is already complete. The checklist starts in practice at step 1.

## 1. Create A Dedicated Cloud Project

- Create a new Google Cloud project just for the add-on.
- Give it an obvious name such as `hoodlefinance-sheets-addon`.
- Record the Cloud project number.

Checklist:

- [X] Cloud project created
- [X] Cloud project number recorded

## 2. Link The Apps Script Project

- Open the new Apps Script project for the Marketplace dry run.
- For this effort, use a clearly named project such as `hoodlefinance-marketplace-addon`.
- Go to `Project Settings`.
- Under the Google Cloud project section, switch from the default Apps Script project to the new standard Cloud project.
- Paste the Cloud project number from step 1.

Use [`appsscript.json`](./appsscript.json) as the baseline manifest. If the current project manifest contains old experiment fields, replace it with that file and then make only intentional additions later.

Manifest cleanup notes:

- keep `urlFetchWhitelist` aligned with the actual fetch targets used by the add-on
- keep `openLinkUrlPrefixes` aligned with the actual external links opened by the add-on
- remove unused library references
- do not add extra scopes beyond what the code and manifest currently need
- keep the manifest small until the private dry run works

Checklist:

- [X] Apps Script project linked to the dedicated standard Cloud project
- [X] Manifest reset to the clean baseline
- [X] Script ID recorded

## 3. Configure OAuth Consent

- Open the linked Cloud project in Google Cloud.
- Configure the OAuth consent screen.
- Use the internal/private audience that fits your Workspace org.
- Fill in the app name, support email, and developer contact email.
- Make sure the scopes match the Apps Script manifest.

Suggested identity shape for this dry run:

- Workspace admin/test user on `falcon.yadan.net`
- no MX migration for `yadan.net`
- Google-hosted mail is acceptable for `falcon.yadan.net`

Checklist:

- [X] OAuth consent configured
- [X] Audience/visibility choice noted
- [X] Scopes match the manifest

## 4. Enable And Configure Marketplace SDK

- Enable the Google Workspace Marketplace SDK in the same Cloud project.
- Start a Marketplace app configuration for the add-on.
- Choose `Private` visibility for the dry run.
- Configure the Sheets/add-on integration details.

Important:

- Visibility is a one-way decision in Marketplace configuration. Treat `Private` vs `Public` as irreversible for this app record.

Checklist:

- [X] Marketplace SDK enabled
- [X] Private visibility selected intentionally
- [X] Integration details configured

## 5. Prepare Minimal Listing Material

For the dry run, keep this minimal but complete enough to move forward.

- app name
- short description
- detailed description
- category
- support link
- privacy policy link
- terms of service link
- icon assets and at least one screenshot if required by the current Marketplace UI

Draft repo-hosted pages are available here:

- [`support.md`](./support.md)
- [`privacy-policy.md`](./privacy-policy.md)
- [`terms-of-service.md`](./terms-of-service.md)

Checklist:

- [X] Listing text prepared
- [X] Support/privacy/terms links prepared
- [X] Required visual assets prepared

## 6. Create A Versioned Apps Script Deployment

- In Apps Script, create a new version if needed.
- Create the deployment needed for Marketplace packaging.
- Record the version number that Marketplace will reference.

Checklist:

- [X] Script version created
- [X] Deployment created
- [X] Version number recorded

## 7. Finish The Private Listing

- Complete the Marketplace listing fields.
- Use the Apps Script identifiers required by the Marketplace flow.
- Save the private listing and make it available for internal installation.

Checklist:

- [X] Listing saved
- [X] Private internal install path available

## 8. Install And Test In A Fresh Spreadsheet

Use a spreadsheet that does not already contain the pasted bound-script install.

Verify:

- the add-on appears under `Extensions`
- the add-on homepage opens
- the add-on menu appears
- `Show installed version` works

Then test the blocker:

- enter `=HOODLEFINANCE("NASDAQ:GOOG")`
- enter a second representative formula such as `=HOODLEFINANCE("SJPA.L","price@USD")`
- if needed, repeat with a minimal test function in the add-on project

Checklist:

- [X] Add-on installs successfully
- [X] Add-on homepage loads
- [X] Add-on menu appears
- [X] Version action works
- [X] `HOODLEFINANCE()` recognized by Sheets
- [X] `HOODLEFINANCE()` returns data as expected

## 9. Record The Outcome

Capture the result clearly in the repo or your notes.

Current answer snapshot from March 21, 2026:

- yes, Marketplace packaging made `HOODLEFINANCE()` discoverable in Sheets
- the add-on homepage loaded successfully
- the add-on menu appeared under `Extensions`
- `Show installed version` worked from the installed add-on
- representative formulas returned data successfully

Checklist:

- [X] Outcome recorded with exact date
- [X] Decide to proceed toward public Marketplace review

## Success Criteria

This dry run is successful if it answers the custom-function question clearly, even if the answer is "no."

The goal is not "publish publicly now." The goal is:

- prove that Marketplace packaging does expose `HOODLEFINANCE()`, or
- prove that it still does not, so the project should not invest further in this direction yet

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
