#!/usr/bin/env python3

from __future__ import annotations

import argparse
import concurrent.futures
import html
import os
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
        "samples": ["NYSE:IBM", "NYSE:KO", "NYSE:DIS"],
    },
    {
        "code": "NASDAQ",
        "name": "Nasdaq",
        "samples": ["GOOG", "AAPL", "MSFT"],
    },
    {
        "code": "LON",
        "name": "London Stock Exchange",
        "samples": ["SJPA.L", "CPXJ.L", "VUAG.L"],
    },
    {
        "code": "ETR",
        "name": "Xetra",
        "samples": ["ZPRV.DE", "ZPRX.DE", "5MVL.DE"],
    },
    {
        "code": "HKG",
        "name": "Hong Kong Stock Exchange",
        "samples": [
            {"ticker": "9988.HK", "label": "9988.HK (Alibaba / BABA)"},
            "1299.HK",
            "1810.HK",
        ],
    },
    {
        "code": "TLV",
        "name": "Tel Aviv Stock Exchange",
        "samples": ["TASE.TA", "POLI.TA", "NICE.TA"],
    },
    {
        "code": "TYO",
        "name": "Tokyo Stock Exchange",
        "samples": ["7203.T", "6758.T", "9984.T"],
    },
    {
        "code": "PSE",
        "name": "Philippine Stock Exchange",
        "samples": ["PSE:BDO", "PSE:AAA", "PSE:JFC"],
    },
        {
        "code": "OTCMKTS",
        "name": "OTC Markets",
        "samples": ["OTCMKTS:RYCEY", "OTCMKTS:NSRGY", "OTCMKTS:TCEHY"],
    },
]

EXCHANGES = sorted(EXCHANGES, key=lambda exchange: str(exchange["name"]))

FEATURES = [
    {
        "key": "basic-quote",
        "label": "Basic quote",
        "attributes": ["price", "name", "currency"],
    },
    {
        "key": "session-stats",
        "label": "Session stats",
        "attributes": ["high", "low", "close"],
    },
    {
        "key": "activity-time",
        "label": "Activity/time",
        "attributes": ["volume", "tradetime", "datadelay"],
    },
    {
        "key": "change",
        "label": "Change",
        "attributes": ["change", "changepct"],
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

DEFAULT_MAX_WORKERS = min(32, max(4, (os.cpu_count() or 4) * 4))


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


def sample_ticker(sample: str | dict[str, str]) -> str:
    if isinstance(sample, dict):
        return str(sample["ticker"]).strip()
    return sample.strip()


def sample_label(sample: str | dict[str, str]) -> str:
    if isinstance(sample, dict):
        return str(sample.get("label") or sample["ticker"]).strip()
    return sample.strip()


def format_samples(samples: list[str | dict[str, str]]) -> str:
    return ", ".join(sample_label(sample) for sample in samples)


def format_exchange_cell(exchange: dict[str, object]) -> str:
    name = html.escape(str(exchange["name"]), quote=True)
    code = str(exchange["code"])
    return f'<code>{code}</code><br><sub>{name}</sub>'


def format_samples_cell(samples: list[str | dict[str, str]]) -> str:
    tooltip = html.escape(format_samples(samples), quote=True)
    return f'<span title="{tooltip}">ⓘ</span>'


def format_header_cell(label: str, tooltip: str) -> str:
    escaped_tooltip = html.escape(tooltip, quote=True)
    return f'<span title="{escaped_tooltip}">{label}</span>'


def format_status_cell(icon: str, tooltip: str) -> str:
    escaped_tooltip = html.escape(tooltip, quote=True)
    return f'<span title="{escaped_tooltip}">{icon}</span>'


def format_feature_header_cell(feature: dict[str, object]) -> str:
    label = str(feature["label"])
    attributes = "<br>".join(f"<code>{html.escape(attribute)}</code>" for attribute in feature["attributes"])
    tooltip = html.escape("Grouped attributes: " + ", ".join(feature["attributes"]), quote=True)
    return f'<span title="{tooltip}">{label}<br><sub>{attributes}</sub></span>'


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


def summarize_failures(failures: list[dict[str, str]]) -> str:
    grouped: dict[str, list[str]] = {}

    for failure in failures:
        attribute = failure["attribute"]
        ticker = failure["ticker"]
        grouped.setdefault(attribute, [])
        if ticker not in grouped[attribute]:
            grouped[attribute].append(ticker)

    parts = []
    for attribute, tickers in grouped.items():
        parts.append(f"{attribute} ({', '.join(tickers)})")
    return "; ".join(parts)


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


def build_probe_plan() -> list[tuple[str, str, str, str]]:
    plan: list[tuple[str, str, str, str]] = []

    for exchange in EXCHANGES:
        exchange_code = str(exchange["code"])
        for feature in FEATURES:
            feature_key = str(feature["key"])
            for sample in exchange["samples"]:
                for attribute in feature["attributes"]:
                    plan.append((exchange_code, feature_key, sample_ticker(sample), attribute))

    return plan


def execute_probe_plan(
    plan: list[tuple[str, str, str, str]],
) -> dict[tuple[str, str, str, str], dict[str, str | bool]]:
    results: dict[tuple[str, str, str, str], dict[str, str | bool]] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=DEFAULT_MAX_WORKERS) as executor:
        future_map = {
            executor.submit(run_probe, sample, attribute): (exchange_code, feature_key, sample, attribute)
            for exchange_code, feature_key, sample, attribute in plan
        }

        for future in concurrent.futures.as_completed(future_map):
            probe_key = future_map[future]
            results[probe_key] = future.result()

    return results


def evaluate_feature(
    exchange: dict[str, object],
    feature: dict[str, object],
    details: list[str],
    reliability_notes: list[str],
    probe_results: dict[tuple[str, str, str, str], dict[str, str | bool]],
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
    failure_records: list[dict[str, str]] = []

    if override and override["note"] not in reliability_notes:
        reliability_notes.append(str(override["note"]))

    for sample in samples:
        probe_ticker = sample_ticker(sample)
        for attribute in attributes:
            total += 1
            result = probe_results[(exchange_code, feature_key, probe_ticker, attribute)]
            if result["ok"]:
                ok_count += 1
            else:
                failure_records.append(
                    {
                        "attribute": attribute,
                        "error": str(result["error"]),
                        "ticker": sample_label(sample),
                    }
                )
                if details is not None:
                    feature_failures.append(f'- `{sample_label(sample)}` + `{attribute}` -> {result["error"]}')

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

    grouped_attributes = ", ".join(attributes)
    if status == "full":
        tooltip = f"All probes passed. Attributes: {grouped_attributes}."
    elif failure_records:
        tooltip = f"Failing probes: {summarize_failures(failure_records)}."
    else:
        tooltip = f"No probes passed. Attributes: {grouped_attributes}."

    if override:
        tooltip += f" Reliability note: {override['note']}"

    return format_status_cell(ICONS[status], tooltip)


def generate_matrix_body(show_details: bool) -> tuple[str, str]:
    probe_results = execute_probe_plan(build_probe_plan())
    lines = [
        "| "
        + " | ".join(
            [
                format_header_cell("Exchange", "Code and full venue name."),
                format_header_cell("Samples", "Hover the info icon to see the sample tickers used for probes."),
            ]
            + [format_feature_header_cell(feature) for feature in FEATURES]
        )
        + " |",
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
            cells.append(
                evaluate_feature(
                    exchange,
                    feature,
                    detail_lines if show_details else [],
                    reliability_notes,
                    probe_results,
                )
            )
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
    output = matrix_body
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
