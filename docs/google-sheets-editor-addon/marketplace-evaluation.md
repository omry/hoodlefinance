# Marketplace Packaging Evaluation

This note evaluates what it would take to move the experimental Google Sheets Editor add-on prototype from an Apps Script test deployment to a real Google Workspace Marketplace package.

It focuses on three questions:

- what Google requires for Marketplace packaging and review
- which Apps Script runtime limits still matter after packaging
- what is still missing in this repo before a realistic publish or dry run

## Bottom Line

Marketplace packaging is still the right next validation path for this prototype, but the current prototype is not publish-ready yet.

The biggest remaining repo-local blockers are no longer the add-on open trigger or menu shape. Those lifecycle issues are now addressed in the prototype.

The most important remaining blockers are now:

- Marketplace/project wiring that still does not exist in the repo
- listing assets and policy/support links
- a real Marketplace validation pass for custom-function exposure in Sheets

## What Google Requires For Packaging

At a high level, a publishable Editor add-on needs four things in place:

1. a standard Google Cloud project, not the default Apps Script project
2. a configured OAuth consent screen and matching declared scopes
3. Google Workspace Marketplace SDK configuration for the add-on
4. a store listing with required assets and support links

### Cloud Project And Publishing Identity

Google's current add-on publishing docs say Apps Script's default Cloud project cannot be used for publishing. The add-on must be switched to a standard Google Cloud project first.

For an Editor add-on, Marketplace SDK configuration uses:

- the Apps Script project script ID
- the version number to publish

This is different from Google Workspace add-ons that publish by deployment ID.

### OAuth Consent And Verification

Before publishing, the OAuth consent screen must be completed and the scopes must match across:

- the Apps Script manifest
- the OAuth consent screen
- the Marketplace SDK configuration

If the final published app uses sensitive or restricted scopes, OAuth verification is a separate gate from Marketplace app review. Google also documents that add-ons are no longer verified as part of add-on review alone.

For public external publishing, OAuth verification can require:

- a demo video
- a verified domain
- publicly accessible app homepage and privacy policy pages on that domain
- possibly a security assessment for restricted scopes

For apps used only internally within one Google Workspace organization, Google documents that sensitive or restricted scopes do not require the same further review.

### Marketplace SDK Configuration

Marketplace SDK configuration determines:

- public vs private visibility
- individual vs admin-only install
- app integrations
- declared OAuth scopes
- developer and trader-status metadata

Visibility matters early because Google documents that once the visibility choice is saved, it cannot be changed later.

That makes a private internal dry run the safest first packaging validation path if a suitable Google Workspace domain is available.

### Store Listing Assets

The current prototype repo does not yet include the required Marketplace listing assets. Google currently requires:

- app name, short description, detailed description, and category
- icons at 128x128 and 32x32
- a 220x140 card banner
- at least one screenshot of the Google integration
- support, privacy policy, and terms of service links

The listing and review docs also require working links, accurate screenshots, and developer information that matches the app and consent screen.

## Review Requirements That Matter Most Here

Google's current Marketplace review criteria for Editor add-ons specifically call out:

- menu items under the add-ons tab
- proper documentation even if the add-on is mainly custom functions
- correct `onInstall()` and `onOpen()` behavior
- correct authorization-mode handling
- V8 runtime

The current prototype partially satisfies this already:

- V8 runtime is already declared in [`appsscript.json`](./appsscript.json)
- `onInstall()` exists and calls `onOpen()`
- the repo already has user-facing documentation for the custom functions
- a homepage card exists for add-on entry

But there are still important gaps.

## Repo-Specific Gaps Before Packaging

### 1. `onOpen()` And Menu Bootstrap

This was an earlier blocker and is now addressed in the prototype runtime.

The current implementation now:

- uses `createAddonMenu()` for the add-on path
- avoids the bound-script automatic update-check flow during add-on `onOpen()`
- keeps the manual bound-script menu and automatic raw-source update checks only for the pasted-script install path

That means the prototype is in better shape for a published Editor add-on where `onOpen()` can run in `AuthMode.NONE`.

### 2. Marketplace Assets And Policy Links Are Missing

The repo currently does not include:

- branded add-on icons
- a banner image
- Marketplace screenshots
- a privacy policy page
- a terms of service page
- a support page
- an application website on a verified domain

The current manifest logo URL is also still a generic Google-hosted icon, which is acceptable as a prototype placeholder but not a good review-ready identity.

### 3. Cloud Project Wiring Still Needs Real Setup

The repo currently has a prototype manifest and code scaffold, but not the publishing-side project setup:

- no documented standard Cloud project for the add-on
- no documented Marketplace SDK app configuration
- no documented OAuth consent configuration for the add-on
- no published script version or script-ID based Marketplace dry run

### 4. Marketplace Validation Still Needs To Prove Custom-Function Exposure

The largest unresolved product question is still whether Marketplace-installed packaging exposes the `HOODLEFINANCE` custom functions correctly in Sheets.

The unpublished test deployment did not prove that. It still produced `Unknown function`, which matched the current public issue tracker behavior cited in the prototype README.

## Runtime Limits That Still Matter After Packaging

Marketplace packaging improves install and update flow, but it does not relax Apps Script execution limits.

The most relevant published limits for this project are:

- custom function runtime: 30 seconds per execution
- Google Workspace add-on runtime: 30 seconds per execution
- general script runtime: 6 minutes per execution
- simultaneous executions per user: 30
- simultaneous executions per script: 1,000
- URL Fetch calls per day: 20,000 for consumer accounts, 100,000 for Google Workspace accounts
- Properties read/write per day: 50,000 for consumer accounts, 500,000 for Google Workspace accounts
- triggers total runtime per day: 90 minutes for consumer accounts, 6 hours for Google Workspace accounts

### What Changes Under A Published Add-On

The important runtime shift is not a new timeout. It is a new sharing model.

With manual bound-script installs:

- each spreadsheet effectively carries its own script project
- heavy usage in one sheet mostly harms that one install

With a published add-on:

- script-level concurrency and some operational pressure become shared across one published script project
- one burst of recalculation or upstream slowness is more likely to affect unrelated users

### What That Means For `HOODLEFINANCE`

The highest-risk runtime modes remain:

- many simultaneous custom-function recalculations in one or more spreadsheets
- slow upstream quote fetches that push formula execution past 30 seconds
- shared `UrlFetchApp` volume across users of one published add-on project
- shared property reads and writes from menu-driven update checks and caches

The existing caching and batched fetch work still helps, but packaging alone does not solve these runtime ceilings.

## Coexistence With The Manual Install Path

Running both install paths at the product level is viable.

In other words, `HOODLEFINANCE` can continue to support:

- the current copy-paste bound-script install path
- a future Marketplace Editor add-on install path

There is no need to force an all-at-once migration to Marketplace before the add-on path is offered.

### Product-Level Coexistence

Supporting both install paths at the same time is reasonable because they solve different user needs:

- Marketplace is the low-friction path for ordinary users
- copy-paste remains useful for advanced users, private experimentation, and cases where Marketplace install is not available or not desired

This should be treated as two supported distribution options for the product, not as two modes that should coexist inside one spreadsheet.

### Same-Spreadsheet Coexistence Is Not A Target

The same spreadsheet should not be expected to host both:

- a pasted bound-script `HOODLEFINANCE` implementation
- a Marketplace-installed add-on exposing `HOODLEFINANCE`

Google's add-on documentation says that if multiple installed add-ons define the same custom function name, users can only use one of them. Even though that wording is specifically about add-on-to-add-on collisions, the same-name custom-function surface is enough reason to treat bound-script plus add-on coexistence as a conflict-prone configuration.

That means the intended product policy should be:

- both install paths are supported globally
- one spreadsheet should use one install path
- users should remove the pasted script before switching that spreadsheet to the Marketplace add-on

### Recommended Conflict Handling

If the add-on detects that the spreadsheet already appears to contain a manual `HOODLEFINANCE` install, it should show a clear user-facing conflict message rather than trying to proceed silently.

The preferred message shape is:

- this spreadsheet already has a pasted `HOODLEFINANCE` script
- the Marketplace add-on should not be used in the same spreadsheet at the same time
- remove the pasted script first, then reload or reopen the spreadsheet

That conflict notice is most realistic in add-on-controlled entry points such as:

- the add-on homepage card
- install/open flows
- add-on menu actions

It should not rely on formula-time detection as the main safety mechanism, because same-name function resolution is exactly the area most likely to be ambiguous.

### Detection Strategy

If this is implemented in code, the safest design is a spreadsheet-level marker that both install paths can read.

A spreadsheet-visible marker is more promising than script-local properties because:

- script properties are local to one Apps Script project
- user properties are local to one Apps Script project and user
- a same-spreadsheet conflict is fundamentally a document-level condition

If conflict detection becomes important enough to implement, evaluate a document-scoped marker such as spreadsheet developer metadata or another document-visible flag that both the bound script and the add-on can read consistently.

For now, the prototype intentionally does not implement that detection yet. The menu/auth hardening is small and locally testable; document-level conflict detection can wait until the Marketplace dry run confirms the add-on path is viable enough to justify more code.

## Version Checks And Migration Behavior

Supporting both install paths also means the project should not treat version checks and upgrade prompts the same way in both modes.

### Marketplace Add-On Version Checks

The current bound-script implementation includes a menu-driven version check against the raw GitHub source.

That behavior makes sense for the copy-paste install path, where users are responsible for replacing the pasted script manually. It is a poor default for a Marketplace-installed add-on, where distribution and updates should be handled by the add-on release path rather than by asking users to compare raw source versions.

For the Marketplace path, the better behavior is:

- keep an installed-version display if it is useful for support and debugging
- keep release notes and documentation links
- do not present the current "check for updates" flow as if Marketplace users are expected to self-update from raw script source

If an add-on-specific update message exists at all, it should explain Marketplace release state in add-on terms, not point users back to the manual script replacement flow.

### Copy-Paste Users Should Stay On The Script Path By Default

Publishing a Marketplace version should not automatically push existing copy-paste users to switch installation methods.

The default behavior should be:

- manual-install users continue receiving manual-install guidance
- their version check continues to compare the pasted script with the current published script source
- they remain on the copy-paste path until they explicitly choose to migrate

This keeps the current user model stable and avoids surprising users who intentionally chose a visible, editable bound script.

### Migration To Marketplace Should Be Explicit

If the project later wants to encourage Marketplace adoption, that should be framed as an explicit migration option, not as a forced or silent install-path change.

Good migration behavior would look like:

- release notes or docs mention that a Marketplace install path exists
- manual users can choose to switch when convenient
- the migration instructions clearly say to remove the pasted script before enabling the add-on in that spreadsheet

Less desirable behavior would be:

- update prompts that imply the only valid next step is switching to Marketplace
- automatic nudges that appear as ordinary version-update messaging
- any mechanism that tries to mutate or replace a user's bound script project automatically

In short:

- Marketplace users should get Marketplace-style update behavior
- copy-paste users should stay on the copy-paste update path until they explicitly migrate
- install-method switching should be a deliberate user action

## Recommended Next Step

The next worthwhile step is not public review submission yet. It is a small publish-readiness hardening pass plus a controlled Marketplace dry run.

Recommended order:

1. Create a standard Google Cloud project and connect the Apps Script project to it.
2. Prepare minimal listing assets and support links.
3. Configure the Marketplace SDK and OAuth consent screen for a private internal dry run.
4. Run a private internal Marketplace dry run if a Workspace domain is available.
5. Use that dry run to answer the remaining functional question: whether Marketplace-installed packaging exposes the `HOODLEFINANCE` custom functions correctly in Sheets.

## Sources

- https://developers.google.com/workspace/add-ons/how-tos/publish-add-on-overview
- https://developers.google.com/workspace/marketplace/enable-configure-sdk
- https://developers.google.com/workspace/marketplace/configure-oauth-consent-screen
- https://developers.google.com/workspace/marketplace/create-listing
- https://developers.google.com/workspace/marketplace/about-app-review
- https://developers.google.com/workspace/add-ons/concepts/editor-auth-lifecycle
- https://developers.google.com/workspace/add-ons/how-tos/testing-editor-addons
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/guides/sheets/functions
- https://developers.google.com/apps-script/guides/client-verification
