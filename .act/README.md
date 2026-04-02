# act Setup

Use these local fixtures to run GitHub Actions workflows from the repo root:

```bash
npm run act:secrets
act -l
act workflow_dispatch -e .act/release-prepare.event.json -n
act workflow_dispatch -e .act/release-publish.event.json -n
```

The `workflow_dispatch` event files only cover the workflow inputs. Add `--secret-file .act/secrets` when you want to exercise secret-backed jobs locally.
Start from `.act/secrets.example` if you want a local secrets file with the expected variable names.
