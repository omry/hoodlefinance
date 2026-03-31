# Google Sheets™ Deployment Strategy

This note evaluates realistic deployment paths for `HOODLEFINANCE` in Google Sheets™.

It is meant to answer one question:

- how should users get the code into their spreadsheets over time?

The current answer is "paste the script into a bound Apps Script™ project." This note evaluates whether that should remain the default, and what the most credible alternative is.

## Current Baseline

Today the repo has two different deployment stories:

- public users manually paste [`hoodlefinance.js`](../../hoodlefinance.js) into a bound Apps Script™ project, as documented in [`README.md`](../../README.md) and [`website/docs/api/overview.md`](../../website/docs/api/overview.md)
- trusted maintainers use [`tools/demo/sync.js`](../../tools/demo/sync.js) plus `clasp` and OAuth credentials to update the managed public demo sheet

That distinction matters:

- the public install path is simple but manual
- the maintainer path is automated but credential-heavy
- the maintainer path is not currently a general end-user deployment model

## Evaluation Criteria

The main criteria for this project are:

- low-friction install for ordinary Sheets users
- a sane update path across releases
- good fit for custom functions plus the existing menu-based helpers
- low operational and support burden for a small project
- compatibility with the current repo and release workflow

## Option 1: Keep Manual Bound-Script Install

This is the current public model.

### Pros

- lowest implementation cost
- no packaging or Marketplace review work
- transparent to advanced users because the code is visible in their sheet
- works well with the current release notes and "replace the script" guidance

### Cons

- every install is manual
- every upgrade is manual
- users can drift onto old versions easily
- copy/paste is a rough first-run experience compared with a normal Sheets add-on

### Verdict

Keep this as the current default until a better distribution path is worth the added product and operational complexity.

## Option 2: Expand `clasp` / Apps Script™ API Deployment

This means leaning harder on the kind of tooling already used for the demo sheet:

- `clasp` for local or CI-driven sync
- Apps Script™ API project creation or update flows
- possibly templated or scripted setup for trusted maintainers

### Pros

- builds on tooling the repo already uses for the demo sheet
- makes maintainer-owned script projects reproducible
- can automate updates for specific trusted spreadsheets

### Cons

- not a good general-user install flow
- requires OAuth setup, Apps Script™ API access, and script-project permissions
- becomes awkward when the target spreadsheet belongs to an ordinary end user
- starts to look like remote management of user script projects rather than a clean product distribution path

### Verdict

Useful for maintainer automation and internal operations, but not recommended as the primary public deployment strategy.

## Option 3: Publish As An Apps Script™ Library

This would move most code into a shared Apps Script™ library and have each spreadsheet keep only a thin wrapper script.

### Pros

- centralizes most implementation code
- gives versioned library updates instead of full copy/paste replacements
- can keep per-sheet wrappers small

### Cons

- users still need a bound script project and still have to wire the library into it
- distribution is awkward because users need script ID access and library setup in the editor
- Google documents that libraries can slightly decrease execution speed and should be used sparingly in performance-critical cases
- `HOODLEFINANCE` is custom-function-heavy, so adding another layer of indirection is not especially attractive

### Verdict

Not recommended. It improves maintainer code reuse more than user installation, while adding runtime and setup complexity.

## Option 4: Publish A Google Sheets™ Add-On

This is the cleanest real alternative to manual paste install.

For this project, the relevant path is a Google Sheets™ Editor add-on. If the product later grows into a broader Workspace™ integration surface, a wider Google Workspace™ add-on could be reconsidered then.

### Pros

- users install the add-on instead of copying code into each spreadsheet
- custom functions can be distributed through the add-on model
- updates can be shipped centrally rather than by asking users to replace pasted code
- the existing menu-oriented helpers fit naturally with an add-on surface

### Cons

- materially higher implementation and release complexity
- requires add-on manifest work, authorization review, packaging, testing, and support
- likely adds Marketplace or domain-install decisions to the project
- Editor add-ons are Apps Script™-based and desktop-oriented, so this is not a free portability upgrade

### Verdict

This is the strongest long-term direction if installation and update friction become important enough to justify a larger product investment.

## Paths Not Recommended

Do not treat "self-updating bound scripts" as the likely solution.

Using the Apps Script™ API to mutate arbitrary user-owned bound script projects would add significant consent, trust, and support complexity without giving the clean install experience of a real add-on. It is a poor middle ground between the current manual model and a proper published add-on.

## Risks And Breaking Modes

There is no obvious immediate deal breaker in the add-on path, but the main technical risks come from Apps Script™ execution limits rather than from Marketplace publishing itself.

The most relevant limits for `HOODLEFINANCE` are:

- custom function runtime ceilings
- simultaneous execution ceilings
- `UrlFetchApp` quota and burst pressure

Those limits already apply to the current project. Packaging the code as a Sheets add-on would not remove them.

### Current Manual Bound-Script Model

Under the current install model, most quota pressure is naturally partitioned:

- each spreadsheet has its own bound Apps Script™ project
- ordinary users mostly affect their own sheet/project rather than unrelated users
- per-user usage such as quote fetch volume is less likely to spill across separate installs

The main shared failure mode in this model is inside one spreadsheet or one heavily shared bound project:

- large recalc bursts can create too many simultaneous executions
- slow upstream fetches can push formula calls past the custom-function time limit

### Published Add-On Model

Under a published add-on model, the quota picture becomes more mixed:

- many daily limits still remain effectively per user
- script-level ceilings become shared by all users of the published add-on project

That means one heavy usage burst can be more likely to affect other users if the shared add-on project hits script-level concurrency ceilings.

### Practical Breaking Modes

The likely user-visible failure modes are:

- `#ERROR!` because a custom function exceeds the Apps Script™ execution time limit
- temporary concurrency errors during large sheet recalculations
- temporary or daily fetch-limit errors when outbound quote lookups exceed available quota
- public release delays when add-on review or policy requirements are not yet satisfied

The first three are runtime scaling risks. The last one is a publishing/distribution risk rather than a runtime architecture failure.

## Recommendation

The best current strategy is:

- keep the public install path manual for now
- keep `clasp`-based deployment limited to maintainer-owned automation such as the demo sheet
- treat a Google Sheets™ Editor add-on as the main long-term upgrade path

In other words:

- near term: do not replace the current manual install flow
- medium term: if install/update friction becomes a priority, prototype a Sheets add-on
- do not invest in self-updating bound-script machinery as an intermediate architecture

## Sources

- [Custom Functions in Google Sheets™](https://developers.google.com/apps-script/guides/sheets/functions)
- [Libraries](https://developers.google.com/apps-script/guides/libraries)
- [Use the command line interface with clasp](https://developers.google.com/apps-script/guides/clasp)
- [Managing Projects](https://developers.google.com/apps-script/api/how-tos/manage-projects)
- [Authorization for Google Services](https://developers.google.com/apps-script/guides/services/authorization)
- [Container-bound scripts](https://developers.google.com/apps-script/guides/bound)
- [Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas)
- [Add-on types](https://developers.google.com/workspace/add-ons/concepts/types)
- [Extending Google Sheets™ with add-ons](https://developers.google.com/workspace/add-ons/editors/sheets)
