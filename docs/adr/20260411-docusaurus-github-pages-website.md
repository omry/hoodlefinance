---
status: Active
updated: 2026-04-11
summary: Deploy the public website from the repo's Docusaurus site to GitHub Pages on the hoodlefinance.com custom domain.
---

# ADR: Docusaurus Site On GitHub Pages

## Context

The project needed a real homepage and stable public docs/policy links on
`hoodlefinance.com`, especially for add-on and OAuth-facing surfaces.

The site needed to live in the repo, deploy automatically from CI, and avoid a
manual upload or redirect-based homepage setup.

## Decision

Use the Docusaurus site under `website/` as the public website source and
deploy it through GitHub Pages on the `hoodlefinance.com` custom domain.

Use GitHub Actions as the deployment mechanism:

- pull requests run the website build check
- pushes to `main` deploy the site to GitHub Pages

Keep the Pages configuration aligned with the repo-local site config and the
checked-in `website/static/CNAME`.

## Consequences

- The public site is versioned and reviewable in the main repo.
- Deploys are automatic after merged website changes.
- Public policy and support links resolve to the canonical domain instead of a
  redirect chain.
- The site depends on the repo's pinned Docusaurus toolchain and GitHub Pages
  workflow configuration.

## Related Docs

- [`../design/deployment/website-deployment-strategy.md`](../design/deployment/website-deployment-strategy.md)
- [`../../website/docusaurus.config.js`](../../website/docusaurus.config.js)
- [`../../.github/workflows/website-deploy.yml`](../../.github/workflows/website-deploy.yml)
