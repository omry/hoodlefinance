# Website Deployment Strategy

This note describes how the public `hoodlefinance.yadan.net` website will be deployed through GitHub Pages.

## Goal

Serve a real homepage and policy/documentation pages on `https://hoodlefinance.yadan.net/` with:

- the latest site as the default
- automatic updates after changes land on `main`
- no manual file upload step
- a real homepage on the verified domain, deployed automatically

## Requirements

The website must provide:

- a real homepage on a verified domain
- no redirect from that homepage to another domain
- stable public links for privacy policy and related support material

The current redirect-based setup is not sufficient for the homepage URL used in OAuth verification.

## Deployment Model

Use Docusaurus as a static site generator and deploy the built site through GitHub Pages on the custom domain.

Deployment flow:

1. Markdown and site source live in this repo.
2. A GitHub Actions workflow watches for website-related changes on `main`.
3. That workflow installs the repo-pinned site tooling and builds the site.
4. The workflow uploads the built static site as a GitHub Pages artifact.
5. GitHub Pages serves the site on `hoodlefinance.yadan.net`.

## Deploy Sequence

Each deploy should do this:

1. check out the repo on GitHub Actions
2. install site dependencies from the repo lockfile
3. build the static site
4. upload the build output to GitHub Pages
5. let GitHub Pages serve the latest published build on the custom domain

The exact build output path, versioned-docs structure, and publish layout should follow the Docusaurus setup and its recommended static deployment practices rather than being hardcoded here.

## GitHub Pages Configuration

The Docusaurus site should be configured with:

- `url: 'https://hoodlefinance.yadan.net'`
- `baseUrl: '/'`
- a `CNAME` file in `website/static/` containing `hoodlefinance.yadan.net`

The GitHub repository Pages settings should use:

- a custom GitHub Actions Pages workflow as the publishing source
- the custom domain `hoodlefinance.yadan.net`

## Trigger Scope

Website deploys should run only when site-affecting files change.

The default trigger should be a path filter in GitHub Actions based on the future Docusaurus site directory, for example:

- `website/**`

Intended direction:

- the website becomes the canonical public-facing documentation surface
- the repo should eventually point readers to the website instead of treating repo docs as the main public docs
- website deploy triggers should therefore stay centered on the website directory and its own assets/config

During migration, if the site temporarily consumes content from other repo paths, those paths can be added to the trigger set as a short-term exception. The long-term goal is to remove that coupling.

The important rule is still:

- do not deploy the website on every push to `main`
- do deploy when the website source changes
- keep unrelated application or docs changes from triggering site rebuilds once the migration is complete

The GitHub Actions path filter should be treated as the primary gate.

## Build Location

Build in GitHub Actions.

The deploy flow should rely on the version of Docusaurus and related tooling declared in the repo, not on a globally installed copy. In practice that means the deploy should run the equivalent of:

- `npm ci`
- the repo's site build command

## Versioning Model

The public site should treat the latest version as the default. Use this Docusaurus model:

- homepage at `/`
- current docs as the default docs version
- older docs versions preserved under versioned paths if versioning is enabled later

## Security Notes

Keep the GitHub Pages surface narrow:

- deploy only from the website workflow
- restrict deploy triggers to website-related paths
- keep the custom domain configured directly on GitHub Pages
- avoid redirect-based homepage behavior for the OAuth-facing site

## Implementation Order

1. Create the Docusaurus site skeleton in the repo.
2. Define the minimum initial content:
   - homepage
   - support page
   - privacy policy page
   - terms page
   - API/help page
3. Configure Docusaurus for the custom domain.
4. Add GitHub Actions workflows for website build and Pages deploy.
5. Point `hoodlefinance.yadan.net` DNS at GitHub Pages and configure the custom domain in repo settings.
