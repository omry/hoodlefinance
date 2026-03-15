# Demo Sheet Assets

The files in this directory are the source of truth for the public `HOODLEFINANCE` demo sheet.

- [`demo-sheet.json`](./demo-sheet.json): tracked metadata for the demo sheet and its bound Apps Script project
- `*.tsv`: one tab per file, written into Google Sheets with `USER_ENTERED` values

## Managed Tabs

- `Start Here` -> [`start-here.tsv`](./start-here.tsv)
- `Compared to GOOGLEFINANCE` -> [`googlefinance-comparison.tsv`](./googlefinance-comparison.tsv)
- `Foreign ETFs` -> [`foreign-etfs.tsv`](./foreign-etfs.tsv)
- `Philippines Stock Exchange (PSE)` -> [`pse.tsv`](./pse.tsv)
- `Ticker Forms` -> [`ticker-forms.tsv`](./ticker-forms.tsv)
- `Array Usage` -> [`array-usage.tsv`](./array-usage.tsv)

## Local Bootstrap

1. Create Google OAuth client credentials for a desktop app with access to:
   - Google Sheets API
   - Google Drive API
   - Google Apps Script API
2. Save the downloaded credentials JSON as:

```text
.demo-sheet.local/oauth-client.json
```

3. Install `clasp` from npm and authenticate it separately:

```sh
npm install -g @google/clasp
clasp login --no-localhost
```
4. Run:

```sh
node tools/sync-demo-sheet.js
```

The sync command stores local-only tokens and temporary clasp files under:

```text
.demo-sheet.local/
```

Those files are ignored by git and must not be committed.

## GitHub Actions Automation

The `Release Publish` workflow syncs the demo as a follow-up job after a real release is published. It uses the same credential shapes as the local flow, but restores them from GitHub Actions secrets:

- `DEMO_SHEET_OAUTH_CLIENT_JSON` -> `.demo-sheet.local/oauth-client.json`
- `DEMO_SHEET_OAUTH_TOKEN_JSON` -> `.demo-sheet.local/oauth-token.json`
- `CLASP_RC_JSON` -> `${HOME}/.clasprc.json`

Important distinction:

- `CLASP_RC_JSON` should contain the authenticated global `clasp` login file from `~/.clasprc.json`
- It should not contain the generated project file at `.demo-sheet.local/clasp-work/.clasp.json`, which only points `clasp` at the bound script project

That workflow is intended to run only from a published release, not from arbitrary pushes.

## Adding A Demo Maintainer

The public demo is intended for a small trusted-maintainer group, not for arbitrary contributors.

To add a new maintainer, the current owner should help them with these high-level steps:

1. Share the public demo spreadsheet with edit access.
2. Add the maintainer's Google account as a test user on the OAuth consent screen while the app remains in `Testing`.
3. Make sure the maintainer can use the Google Cloud project that owns the OAuth client, or help them create a new desktop OAuth client in that project.
4. Have the maintainer enable the Apps Script API for their own account at:

```text
https://script.google.com/home/usersettings
```

5. Have the maintainer install `clasp` from npm and authenticate it locally:

```sh
npm install -g @google/clasp
clasp login --no-localhost
```
6. Have the maintainer save a valid OAuth desktop-client JSON at:

```text
.demo-sheet.local/oauth-client.json
```

7. Walk them through one successful run of:

```sh
node tools/sync-demo-sheet.js
```

After that, the maintainer should be able to refresh the demo sheet on their own.

In practice, a successful first sync confirms that all required access is in place:

- spreadsheet edit access
- OAuth test-user access
- Apps Script API enabled for the maintainer account
- working local `clasp` login
- working local OAuth credentials for the sync script

## Update Flow

When the public demo needs to be refreshed:

1. Update [`hoodlefinance.js`](../../hoodlefinance.js) as needed.
2. Edit the relevant TSV files in this directory.
3. Run `node tools/sync-demo-sheet.js`.
4. Confirm the public sheet shows the current `=HOODLEFINANCE_VERSION()`.
