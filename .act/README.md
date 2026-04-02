# act Setup

This directory holds the local fixtures for running GitHub Actions workflows with `act` from the repo root.

## Requirements

- Docker must be installed and running.
- `act` must be on your `PATH`.
- Optional: `gh auth login` if you want `npm run act:secrets` to seed `GITHUB_TOKEN` from your GitHub CLI session instead of using the local placeholder.

If `act` cannot talk to Docker in WSL, enable Docker Desktop WSL integration and verify `docker version` works first.

## Secrets

Create or refresh the local secrets file with:

```bash
npm run act:secrets
```

That writes [`.act/secrets`](./secrets), which stays ignored by git. Start from [`.act/secrets.example`](./secrets.example) if you want to see the expected variable names.

## Common Commands

```bash
act -l
act workflow_dispatch -e .act/release-prepare.event.json -n
act workflow_dispatch -e .act/release-publish.event.json -n
act workflow_dispatch -e .act/release-publish.dry-run.event.json --secret-file .act/secrets -j publish-addon
```

The `workflow_dispatch` event files only cover workflow inputs. Add `--secret-file .act/secrets` when you want to exercise secret-backed jobs locally.

The dry-run release event exercises the add-on publish path without creating a new Apps Script version, which is useful for checking the version-history inspection logic.

## Notes

- The repo-local [`.actrc`](../.actrc) already points `act` at the GitHub Actions workflow directory and the `ubuntu-latest` runner image we use for local testing.
- Run these commands from the repo root so the relative fixture paths resolve correctly.
