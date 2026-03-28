# Shared Brand Assets

This directory is the canonical source tree for HoodleFinance visual brand assets.

Theme-specific SVG sources live under:

- [`svg/dark/`](./svg/dark/)
- [`svg/light/`](./svg/light/)

These sources drive generated outputs for:

- the website under [`../website/static/img/hoodlefinance/`](../website/static/img/hoodlefinance/)
- the Google Workspace Marketplace assets under [`../docs/google-sheets-editor-addon/assets/marketplace/`](../docs/google-sheets-editor-addon/assets/marketplace/)

For the website, the homepage uses the generated themed SVG hero art directly, and the pipeline also renders a light-theme PNG social-share image for metadata.

## Regenerating Outputs

If you have not set up the repo-local Python environment yet, create it first:

```sh
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install hydra-core cairosvg
```

To regenerate all configured website and Marketplace assets:

```sh
./.venv/bin/python tools/assets/generate-marketplace-assets.py
```

The generator configuration lives in [`../tools/assets/config.yaml`](../tools/assets/config.yaml).

To regenerate only part of the set, override the configured targets on the command line. For example:

```sh
./.venv/bin/python tools/assets/generate-marketplace-assets.py targets=[website_light_icon]
./.venv/bin/python tools/assets/generate-marketplace-assets.py targets=[marketplace_light_banner]
```
