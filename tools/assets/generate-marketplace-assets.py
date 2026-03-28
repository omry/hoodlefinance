#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0

"""Generate Marketplace PNG assets from SVG source files."""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import cairosvg
except ModuleNotFoundError:
    cairosvg = None

try:
    import hydra
    from omegaconf import DictConfig
except ModuleNotFoundError as exc:  # pragma: no cover - import-time UX
    missing_module = exc.name or "hydra-core"
    print(
        "Error: missing Python dependency '"
        + missing_module
        + "'. Run this tool from the repo-local .venv, for example:\n"
        + "  ./.venv/bin/python tools/assets/generate-marketplace-assets.py",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


SUPPORTED_BACKENDS = ("cairosvg", "rsvg-convert", "inkscape", "magick", "convert")


def resolve_backend(requested: str) -> str:
    if requested != "auto":
        if requested == "cairosvg":
            if cairosvg is None:
                raise RuntimeError("Requested backend 'cairosvg' is not installed.")
            return requested
        if shutil.which(requested) is None:
            raise RuntimeError(f"Requested backend '{requested}' is not installed.")
        return requested

    for backend in SUPPORTED_BACKENDS:
        if backend == "cairosvg":
            if cairosvg is not None:
                return backend
            continue
        if shutil.which(backend):
            return backend

    raise RuntimeError(
        "No supported SVG renderer found. Install one of: "
        + ", ".join(SUPPORTED_BACKENDS)
    )


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        header = fh.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise RuntimeError(f"{path} is not a valid PNG.")
    width, height = struct.unpack(">II", header[16:24])
    return width, height


def validate_png(path: Path, width: int, height: int) -> None:
    if not path.exists():
        raise RuntimeError(f"Renderer did not create {path}.")

    actual_width, actual_height = png_dimensions(path)
    if (actual_width, actual_height) != (width, height):
        raise RuntimeError(
            f"{path} has unexpected size {actual_width}x{actual_height}; "
            f"expected {width}x{height}."
        )

    minimum_bytes = 200 if max(width, height) <= 128 else 1000
    size = path.stat().st_size
    if size < minimum_bytes:
        raise RuntimeError(
            f"{path} looks suspiciously small ({size} bytes). "
            "Use rsvg-convert or Inkscape for reliable SVG rendering."
        )


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def run_backend(
    backend: str,
    svg_path: Path,
    png_path: Path,
    width: int,
    height: int,
) -> None:
    ensure_parent_dir(png_path)

    if backend == "cairosvg":
        assert cairosvg is not None
        cairosvg.svg2png(
            url=str(svg_path),
            write_to=str(png_path),
            output_width=width,
            output_height=height,
        )
    elif backend == "rsvg-convert":
        cmd = [
            "rsvg-convert",
            "--keep-aspect-ratio",
            "--background-color=transparent",
            "--width",
            str(width),
            "--height",
            str(height),
            "--output",
            str(png_path),
            str(svg_path),
        ]
    elif backend == "inkscape":
        cmd = [
            "inkscape",
            str(svg_path),
            "--export-type=png",
            f"--export-filename={png_path}",
            f"--export-width={width}",
            f"--export-height={height}",
        ]
    elif backend == "magick":
        cmd = [
            "magick",
            str(svg_path),
            "-resize",
            f"{width}x{height}",
            str(png_path),
        ]
    elif backend == "convert":
        cmd = [
            "convert",
            str(svg_path),
            "-resize",
            f"{width}x{height}",
            str(png_path),
        ]
    else:
        raise RuntimeError(f"Unsupported backend: {backend}")

    if backend != "cairosvg":
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    validate_png(png_path, width, height)


def render_svg(
    backend: str,
    svg_path: Path,
    png_path: Path,
    width: int,
    height: int,
) -> None:
    try:
        run_backend(backend, svg_path, png_path, width, height)
    except subprocess.CalledProcessError as exc:
        if png_path.exists():
            png_path.unlink()
        stderr = exc.stderr.decode("utf-8", errors="replace").strip()
        stdout = exc.stdout.decode("utf-8", errors="replace").strip()
        details = stderr or stdout or str(exc)
        raise RuntimeError(
            f"{backend} failed while rendering {svg_path} -> {png_path}: {details}"
        ) from exc
    except Exception as exc:
        if png_path.exists():
            png_path.unlink()
        if isinstance(exc, RuntimeError):
            raise
        raise RuntimeError(
            f"{backend} failed while rendering {svg_path} -> {png_path}: {exc}"
        ) from exc
    except RuntimeError:
        if png_path.exists():
            png_path.unlink()
        raise


def resolution_fields(entry: Any) -> dict[str, str]:
    if isinstance(entry, int):
        return {
            "width": str(entry),
            "height": str(entry),
            "resolution": str(entry),
        }

    if isinstance(entry, DictConfig):
        entry = dict(entry.items())

    if isinstance(entry, dict):
        width = int(entry["width"])
        height = int(entry.get("height", width))
        return {
            "width": str(width),
            "height": str(height),
            "resolution": f"{width}x{height}",
        }

    raise RuntimeError(f"Unsupported resolution entry: {entry!r}")


def copy_svg(svg_path: Path, output_path: Path) -> None:
    ensure_parent_dir(output_path)
    shutil.copyfile(svg_path, output_path)


def render_asset(asset_name: str, asset_cfg: DictConfig, backend: str) -> list[Path]:
    svg_path = Path(asset_cfg.svg.path)

    if not svg_path.exists():
        raise RuntimeError(f"{asset_name}: missing SVG source {svg_path}")

    generated: list[Path] = []
    copy_to = asset_cfg.svg.get("copy_to")
    if copy_to:
        output_path = Path(str(copy_to))
        copy_svg(svg_path, output_path)
        generated.append(output_path)

    output_cfg = asset_cfg.svg.get("output")
    if output_cfg is not None:
        output_base = str(output_cfg.path)
        name_pattern = str(output_cfg.name_pattern)
        for entry in output_cfg.resolutions:
            fields = resolution_fields(entry)
            width = int(fields["width"])
            height = int(fields["height"])
            output_path = Path(
                name_pattern.format(
                    width=fields["width"],
                    height=fields["height"],
                    resolution=fields["resolution"],
                    stem=svg_path.stem,
                    path=output_base,
                )
            )
            render_svg(backend, svg_path, output_path, width, height)
            generated.append(output_path)

    return generated


@hydra.main(
    version_base=None,
    config_path=".",
    config_name="config",
)
def hydra_main(cfg: DictConfig) -> None:
    try:
        backend = resolve_backend(str(cfg.backend))

        generated: list[Path] = []
        for target in cfg.targets:
            asset_cfg = cfg.assets.get(target)
            if asset_cfg is None:
                raise RuntimeError(f"Unknown target '{target}'.")
            generated.extend(render_asset(str(target), asset_cfg, backend))

        for path in generated:
            print(path)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    hydra_main()
