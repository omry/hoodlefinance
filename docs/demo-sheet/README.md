# Demo Sheet Assets

The files in this directory are the source of truth for the public `HOODLEFINANCE` demo sheet.

- [`demo-sheet.json`](./demo-sheet.json): tracked metadata for the demo sheet and its bound Apps Script project
- `*.tsv`: one tab per file, written into Google Sheets with `USER_ENTERED` values

## Managed Tabs

- `Start Here` -> [`start-here.tsv`](./start-here.tsv)
- `Market Coverage` -> [`foreign-etfs.tsv`](./foreign-etfs.tsv)
- `Currency & FX` -> [`currency.tsv`](./currency.tsv)
- `Ticker Forms` -> [`ticker-forms.tsv`](./ticker-forms.tsv)
- `Advantages over GOOGLEFINANCE` -> [`googlefinance-comparison.tsv`](./googlefinance-comparison.tsv)

## Local Bootstrap

1. In the dedicated Google Cloud project for demo maintenance, `HoodleFinance Demo Sheets`, create Google OAuth client credentials for a desktop app with access to:
   - Google Sheets API
   - Google Drive API
   - Google Apps Script API
2. Save the downloaded staging credentials JSON as:

```text
.demo-sheet.local/staging/oauth-client.json
```

3. Install the repo-pinned local tooling with `npm install`, then log into `clasp` with your personal staging Google account so the default home-directory auth file is ready:

```sh
npm install
npm exec -- clasp login
```
4. Run the staging sync to confirm your credentials and access without touching the public demo:

```sh
npm exec -- node tools/sync-demo-sheet.js --staging
```

The sync command stores local-only tokens and temporary clasp files under:

```text
.demo-sheet.local/
```

Those files are ignored by git and must not be committed. The staging flow uses `.demo-sheet.local/staging/oauth-client.json` and `.demo-sheet.local/staging/oauth-token.json`. The staging sheet ID and related staging metadata are also stored locally in the ignored file `docs/demo-sheet/demo-sheet-staging.json`.

When that staging override file omits `sharePublicReadOnly`, the staging sync now inherits the tracked public-demo sharing default. Set it explicitly to `false` only if you want a private staging sheet.

If you want to run a local production `--production` sync, keep that production auth separate from your personal staging login. Save the production `clasp` auth file at:

```text
.demo-sheet.local/production/.clasprc.json
```

The local `--production` flow also uses its own OAuth files under `.demo-sheet.local/production/`, separate from staging:

```text
.demo-sheet.local/production/oauth-client.json
.demo-sheet.local/production/oauth-token.json
```

Create that repo-local production `clasp` auth file with:

```sh
npm exec -- clasp -A .demo-sheet.local/production/.clasprc.json login --creds .demo-sheet.local/production/oauth-client.json
```

The sync tool uses your normal `~/.clasprc.json` for staging, but passes `-A .demo-sheet.local/production/.clasprc.json` for local `--production` runs. In CI, the workflow exposes the same production credential shapes through path overrides without writing them to the workspace. The old `--live-demo` flag and `.demo-sheet.local/live-demo/` path are still accepted as legacy aliases.

To confirm which `clasp` accounts the configured staging and production flows will use:

```sh
npm run clasp:user
```

If the saved demo OAuth token is revoked or expires on the Google side, rerunning `npm exec -- node tools/sync-demo-sheet.js` will prompt a fresh browser authorization. If the OAuth client, test-user access, or Google Cloud project permissions changed, you still need to fix that access manually.

## GitHub Actions Automation

The normal release path is:

1. `Release Prepare` opens a `release/vX.Y.Z` PR.
2. A maintainer reviews and merges that PR.
3. The merged PR automatically triggers `Release Publish`.
4. `Release Publish` tags the merge commit, creates the GitHub Release, and then runs the demo-sync job with `node tools/sync-demo-sheet.js --production`.

That demo-sync job uses the same credential shapes as the local flow, but keeps them out of the runner filesystem by exposing them through shell-owned file descriptors for the duration of the sync step:

- `DEMO_SHEET_OAUTH_CLIENT_JSON` -> a `/proc/.../fd/...` path backed by the workflow shell
- `DEMO_SHEET_OAUTH_TOKEN_JSON` -> a `/proc/.../fd/...` path backed by the workflow shell
- `CLASP_RC_JSON` -> a `/proc/.../fd/...` path backed by the workflow shell

Important distinction:

- `CLASP_RC_JSON` should contain the same maintainer `clasp` auth JSON that the local `--production` flow keeps in `.demo-sheet.local/production/.clasprc.json`
- It should not contain the generated project file at `.demo-sheet.local/production/clasp-work/.clasp.json`, which only points `clasp` at the bound script project
- The workflow treats the OAuth token as read-only in CI, so a token refresh should be handled by replacing the GitHub secret rather than by writing back through the file-descriptor path.
- All three secret values should be valid JSON. If `clasp` or the OAuth loader reports a JSON parse error in CI, re-copy the secret from the local source file.

## Update Flow

Normal local development should use the staging target:

1. Update [`hoodlefinance.js`](../../hoodlefinance.js) as needed.
2. Edit the relevant TSV files in this directory.
3. Run `npm exec -- node tools/sync-demo-sheet.js --staging`.
4. Check the staging sheet referenced by your local `docs/demo-sheet/demo-sheet-staging.json` override.

The production public demo should normally be updated by `Release Publish`, which runs `node tools/sync-demo-sheet.js --production`.

Use a direct production sync only for demo-only fixes between releases:

1. Save the production OAuth client, OAuth token, and `clasp` auth files under `.demo-sheet.local/production/`.
2. Optional: run `npm exec -- node tools/sync-demo-sheet.js --production --dry-run`.
3. Run `npm exec -- node tools/sync-demo-sheet.js --production`.
4. Confirm the public sheet shows the intended demo-only content changes.

If you prefer `npm run`, use either:

```sh
npm run demo:sync:production:dry-run
npm run demo:sync:production
```

If you prefer passing flags manually through `npm run`, keep the target explicit and do not omit the `--` separator:

```sh
npm run demo:sync -- --production --dry-run
npm run demo:sync -- --production
```

## Adding A Demo Maintainer

The public demo is intended for a small trusted-maintainer group, not for arbitrary contributors.

To add a new maintainer, the current owner should help them with these high-level steps:

1. Share the public demo spreadsheet with edit access.
2. Add the maintainer's Google account as a test user on the OAuth consent screen while the app remains in `Testing`.
3. Make sure the maintainer can use the dedicated `HoodleFinance Demo Sheets` Google Cloud project, or help them create a new desktop OAuth client in that project.
4. Have the maintainer enable the Apps Script API for their own account at:

```text
https://script.google.com/home/usersettings
```

5. Have the maintainer install the repo-pinned local tooling with `npm install` and log into `clasp` with the Google account they will use for staging.

```sh
npm install
npm exec -- clasp login
```
6. Have the maintainer save a valid OAuth desktop-client JSON at:

```text
.demo-sheet.local/staging/oauth-client.json
```

7. Walk them through one successful staging run of:

```sh
npm exec -- node tools/sync-demo-sheet.js --staging
```

After that, the maintainer should be able to refresh the demo sheet on their own.

In practice, a successful first sync confirms that all required access is in place:

- spreadsheet edit access
- OAuth test-user access
- Apps Script API enabled for the maintainer account
- working local `clasp` login
- working local OAuth credentials for the sync script

Keep this project separate from the Marketplace review project. The desktop OAuth client for demo sync should live in `HoodleFinance Demo Sheets`, not in `HoodleFinance Add-on Public`.
