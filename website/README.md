# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install --global npm@11.9.0
npm ci
```

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true npm run deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

The production GitHub Actions deploy reads `WEBSITE_GA_MEASUREMENT_ID` from repository secrets so Google Analytics stays out of the repo and out of local builds unless you set it yourself.

## Dependency maintenance

Use Node 24 and npm 11.9.0, matching the project declarations. Install the
pinned npm version with `npm install --global npm@11.9.0`, then use `npm ci`.

The [Node maintenance workflows](https://github.com/hydra-ecosystem/github-actions/blob/main/docs/node-maintenance.md)
check security every Monday at 02:00 UTC and propose routine upgrades quarterly,
on January 1, April 1, July 1, and October 1 at 02:00 UTC. New releases have a
ten-day cooldown. The repository-root `.github/node-maintenance.json` points to the shared
policy; edit its overrides to change project policy, and keep caller cron entries
in `.github/workflows/dependency-audit.yml` consistent with the resolved schedule.

To run an audit sooner, open **Actions → Node dependency maintenance → Run workflow**
on `main` and select `security` or `upgrades`. The action validates dependency
changes before opening or updating one maintenance PR. A toolchain or schedule
mismatch fails preflight and opens or updates a configuration issue. The action
does not rewrite toolchain declarations.

Publication uses the built-in token and requires **Allow GitHub Actions to create
and approve pull requests** in **Settings → Actions → General → Workflow
permissions**. Default token permissions remain read-only. The workflow does
not approve or merge its own PRs.
