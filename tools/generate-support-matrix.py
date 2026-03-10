#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
CLI_PATH = ROOT_DIR / "tools" / "cli.js"
README_PATH = ROOT_DIR / "README.md"
MARKER_START = "<!-- SUPPORT_MATRIX:START -->"
MARKER_END = "<!-- SUPPORT_MATRIX:END -->"

EXCHANGES = [
    {
        "code": "NYSE",
        "name": "New York Stock Exchange",
        "samples": ["NYSE:IBM", "NYSE:KO"],
    },
    {
        "code": "NASDAQ",
        "name": "Nasdaq",
        "samples": ["GOOG", "AAPL"],
    },
    {
        "code": "LON",
        "name": "London Stock Exchange",
        "samples": ["SJPA.L", "CPXJ.L"],
    },
    {
        "code": "ETR",
        "name": "Xetra",
        "samples": ["ZPRV.DE", "ZPRX.DE", "5MVL.DE"],
    },
    {
        "code": "TYO",
        "name": "Tokyo Stock Exchange",
        "samples": ["7203.T"],
    },
    {
        "code": "PSE",
        "name": "Philippine Stock Exchange",
        "samples": ["PSE:BDO", "PSE:AAA"],
    },
]

FEATURES = [
    {
        "key": "quote",
        "label": "Quote attrs",
        "attributes": ["price", "name", "currency"],
    },
    {
        "key": "isin",
        "label": "ISIN",
        "attributes": ["isin"],
    },
]

# Format: exchange, feature, cap, note
RELIABILITY_OVERRIDES = []

ICONS = {
    "full": "✅",
    "none": "❌",
    "partial": "⚠️",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="generate-support-matrix.py",
        description="Generate the README support matrix from live CLI probes.",
    )
    parser.add_argument("--details", action="store_true", help="include failing probe details")
    parser.add_argument(
        "--update-readme",
        action="store_true",
        help="replace the README support-matrix block between marker comments",
    )
    return parser.parse_args()


def format_samples(samples: list[str]) -> str:
    return ", ".join(sample.strip() for sample in samples)


def format_exchange_cell(exchange: dict[str, object]) -> str:
    name = html.escape(str(exchange["name"]), quote=True)
    code = str(exchange["code"])
    return f'<span title="{name}"><code>{code}</code></span>'


def format_samples_cell(samples: list[str]) -> str:
    tooltip = html.escape(format_samples(samples), quote=True)
    return f'<span title="{tooltip}">ⓘ</span>'


def lookup_reliability_override(exchange_code: str, feature_key: str):
    for override_exchange, override_feature, override_cap, override_note in RELIABILITY_OVERRIDES:
        if override_feature != feature_key:
            continue
        if override_exchange == "*" or override_exchange == exchange_code:
            return {
                "cap": override_cap,
                "note": override_note,
            }
    return None


def run_probe(ticker: str, attribute: str) -> dict[str, str | bool]:
    result = subprocess.run(
        ["node", str(CLI_PATH), ticker, attribute],
        capture_output=True,
        text=True,
        check=False,
    )
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    if result.returncode == 0 and stdout:
        return {
            "ok": True,
            "output": stdout,
            "error": "",
        }

    return {
        "ok": False,
        "output": stdout,
        "error": stderr or "failed",
    }


def evaluate_feature(
    exchange: dict[str, object],
    feature: dict[str, object],
    details: list[str],
    reliability_notes: list[str],
) -> str:
    samples = list(exchange["samples"])
    attributes = list(feature["attributes"])
    exchange_code = str(exchange["code"])
    feature_key = str(feature["key"])
    feature_label = str(feature["label"])
    override = lookup_reliability_override(exchange_code, feature_key)
    ok_count = 0
    total = 0
    feature_failures: list[str] = []

    if override and override["note"] not in reliability_notes:
        reliability_notes.append(str(override["note"]))

    for sample in samples:
        for attribute in attributes:
            total += 1
            result = run_probe(sample, attribute)
            if result["ok"]:
                ok_count += 1
            elif details is not None:
                feature_failures.append(f'- `{sample}` + `{attribute}` -> {result["error"]}')

    if feature_failures:
        details.append("")
        details.append(f"### {exchange_code} / {feature_label}")
        details.extend(feature_failures)

    if ok_count == total:
        status = "full"
    elif ok_count == 0:
        status = "none"
    else:
        status = "partial"

    if override and override["cap"] == "partial" and status == "full":
        status = "partial"

    return ICONS[status]


def generate_matrix_body(show_details: bool) -> tuple[str, str]:
    lines = [
        "| Exchange | Samples | " + " | ".join(feature["label"] for feature in FEATURES) + " |",
        "| --- | --- | " + " | ".join("---" for _ in FEATURES) + " |",
    ]
    detail_lines: list[str] = []
    reliability_notes: list[str] = []

    for exchange in EXCHANGES:
        cells = [
            format_exchange_cell(exchange),
            format_samples_cell(list(exchange["samples"])),
        ]
        for feature in FEATURES:
            cells.append(evaluate_feature(exchange, feature, detail_lines if show_details else [], reliability_notes))
        lines.append("| " + " | ".join(cells) + " |")

    lines.append("")
    lines.append("Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.")

    if reliability_notes:
        lines.append("")
        lines.append("Reliability overrides:")
        lines.extend(f"- {note}" for note in reliability_notes)

    details_block = "\n".join(detail_lines).strip()
    return "\n".join(lines), details_block


def generate_output(show_details: bool) -> str:
    matrix_body, details_block = generate_matrix_body(show_details)
    output = f"Current generated matrix:\n\n{matrix_body}"
    if show_details and details_block:
        output += "\n\n" + details_block
    return output


def update_readme(generated_block: str) -> None:
    content = README_PATH.read_text(encoding="utf8")

    if MARKER_START not in content or MARKER_END not in content:
        raise SystemExit(f"README markers not found in {README_PATH}")

    start_index = content.index(MARKER_START) + len(MARKER_START)
    end_index = content.index(MARKER_END)
    replacement = "\n" + generated_block.rstrip() + "\n"
    updated = content[:start_index] + replacement + content[end_index:]
    README_PATH.write_text(updated, encoding="utf8")


def main() -> int:
    args = parse_args()
    output = generate_output(args.details)

    if args.update_readme:
        update_readme(output)
        print(f"Updated README support matrix in {README_PATH}")
        return 0

    print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
