# OAuth Review Preparation

This note captures the current OAuth-review surface for the Google Sheets Editor add-on prototype and the short justifications needed for public Marketplace review.

## Current Scope Set

Apps Script manifest scopes in [`appsscript.json`](./appsscript.json):

- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/spreadsheets.currentonly`

Older Marketplace/OAuth consent behavior observed during the private dry run:

- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

The two identity scopes above were not added intentionally to the Apps Script manifest. They were seen in earlier Google-side configuration despite not being part of the repo-local manifest, so they should be treated as Google-managed consent items if they reappear rather than as product-chosen runtime scopes.

## Scope Justifications

### `https://www.googleapis.com/auth/script.external_request`

This scope is used so the add-on can fetch market and reference data from external upstream sources needed to fulfill `HOODLEFINANCE()` formulas and related add-on actions.

Without this scope, the add-on cannot retrieve quote, identifier, and conversion data from the external services it depends on.

### `https://www.googleapis.com/auth/spreadsheets.currentonly`

This scope is used so the add-on can operate on the current spreadsheet context only, instead of requesting broader spreadsheet access.

This is the narrowest spreadsheet scope that still allows the add-on to run inside the active Google Sheet.

## Identity Scope Note

The current add-on code does not intentionally use Google profile data. Earlier Google-side Marketplace/OAuth configuration showed `userinfo.email` and `userinfo.profile` despite those scopes not being part of the repo-local manifest.

Working assumption for review:

- the manifest scopes above are the product's intentional runtime scopes
- the identity scopes should be treated as Google-managed consent behavior only if they reappear in the final public-review path

If Google asks about the identity scopes during OAuth verification, the safest explanation is:

- they were surfaced automatically by the Google Workspace Marketplace / OAuth consent flow
- they are not currently consumed directly by the add-on logic
- the product's functional scope requirements are the two manifest scopes listed above

## Other Likely OAuth Review Material

Prepare these alongside the scope justifications:

- public support URL
- public privacy policy URL
- public terms of service URL
- short demo video showing install and basic use
- confirmation that the public-facing URLs remain stable
