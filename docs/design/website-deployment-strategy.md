# Website Deployment Strategy

This note describes how the public `hoodlefinance.yadan.net` website will be deployed.

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

Use Docusaurus as a static site generator and deploy it through a pull-based server workflow.

Deployment flow:

1. Markdown and site source live in this repo.
2. A GitHub Actions workflow watches for website-related changes on `main`.
3. That workflow calls a small webhook on the server.
4. The server validates the webhook, throttles repeated requests, and starts a local deploy.
5. The server fetches the latest repo state, installs the repo-pinned site tooling locally, builds the site, and atomically switches the served site to the new build.

## Server Paths

The server needs:

- a local repo checkout used for fetch/build
- a served site directory for the active static output
- a small shared area for lock files, cooldown markers, logs, and temporary state

The exact directory layout is an implementation detail. Apache should serve the built static site output, not the git checkout directly.

## Deploy Sequence

Each deploy should do this:

1. acquire a deploy lock
2. check cooldown/throttle state
3. `git fetch origin`
4. reset the local checkout to `origin/main`
5. install site dependencies from the repo lockfile
6. build the static site
7. publish the built site output to the active served location
8. clean up any temporary deploy state as needed

The exact build output path, versioned-docs structure, and publish layout should follow the Docusaurus setup and its recommended static deployment practices rather than being hardcoded here.

## Webhook Contract

GitHub Actions should call a small server endpoint, for example:

- `POST /deploy-hook/hoodlefinance-site`

The webhook should be minimal:

- verify a shared secret or HMAC
- accept only the expected repo and branch
- return quickly
- trigger local deploy work asynchronously

GitHub Actions should **not** upload site files.

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

The GitHub Actions path filter should be treated as the primary gate. The server webhook can remain simple and assume that a webhook call already means "site-related changes occurred."

## Throttling And Duplicate Control

The webhook should tolerate repeated calls without repeatedly rebuilding the site.

Use these controls:

- a lock file via `flock` so only one deploy runs at a time
- a cooldown window, for example 60-120 seconds
- a "pending" marker so if multiple webhooks arrive during one deploy, they collapse into at most one follow-up deploy

Webhook behavior:

- if a deploy is already running, record that another deploy is pending and return `202 Accepted`
- if a webhook arrives during cooldown and nothing new is pending, ignore it and return `202 Accepted`

## Build Location

Build on the server, not in GitHub Actions.

The server needs:

- Node/npm
- permission to install repo-managed site dependencies during deploy

The deploy flow should rely on the version of Docusaurus and related tooling declared in the repo, not on a globally installed copy. In practice that means the deploy should run the equivalent of:

- `npm ci`
- the repo's site build command

## Versioning Model

The public site should treat the latest version as the default. Use this Docusaurus model:

- homepage at `/`
- current docs as the default docs version
- older docs versions preserved under versioned paths if versioning is enabled later

## Security Notes

Keep the deploy surface narrow:

- use a dedicated non-root deploy user
- keep Apache config changes outside the normal deploy path
- do not grant `sudo` to the webhook/deploy user
- restrict writes to the site root only
- log webhook calls and deploy results

The webhook should never execute arbitrary shell input from the request body.

## Implementation Order

1. Create the Docusaurus site skeleton in the repo.
2. Define the minimum initial content:
   - homepage
   - support page
   - privacy policy page
   - terms page
   - API/help page
3. Add a small server-side deploy script and webhook handler.
4. Add a GitHub Actions workflow that only triggers the webhook on pushes to `main`.
5. Point Apache at the `current/` release path.
