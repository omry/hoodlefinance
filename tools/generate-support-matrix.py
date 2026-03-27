#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0


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
SUPPORT_MATRIX_PATH = ROOT_DIR / "website" / "docs" / "support-matrix.md"

EXCHANGES = [
    {
        "code": "NYSE",
        "name": "New York Stock Exchange",
        "samples": ["NYSE:IBM", "NYSE:KO", "NYSE:DIS"],
        "google_query_samples": ["NYSE:IBM", "NYSE:KO", "NYSE:DIS"],
        "yahoo_query_samples": ["IBM", "KO", "DIS"],
        "isin_lookup_samples": [
            {"ticker": "US4592001014", "label": "US4592001014 (IBM)"},
        ],
    },
    {
        "code": "NASDAQ",
        "name": "Nasdaq",
        "samples": ["GOOG", "AAPL", "MSFT"],
        "google_query_samples": ["NASDAQ:GOOG", "NASDAQ:AAPL", "NASDAQ:MSFT"],
        "yahoo_query_samples": ["GOOG", "AAPL", "MSFT"],
        "isin_lookup_samples": [
            {"ticker": "US02079K1079", "label": "US02079K1079 (GOOG)"},
        ],
    },
    {
        "code": "LON",
        "name": "London Stock Exchange",
        "samples": ["SJPA.L", "CPXJ.L", "VUAG.L"],
        "google_query_samples": ["LON:SJPA", "LON:CPXJ", "LON:VUAG"],
        "yahoo_query_samples": ["SJPA.L", "CPXJ.L", "VUAG.L"],
        "isin_lookup_samples": [
            {"ticker": "IE00B4L5YX21", "label": "IE00B4L5YX21 (SJPA)"},
        ],
    },
    {
        "code": "ETR",
        "name": "Xetra",
        "samples": ["ZPRV.DE", "ZPRX.DE", "5MVL.DE"],
        "google_query_samples": ["ETR:ZPRV", "ETR:ZPRX", "ETR:5MVL"],
        "yahoo_query_samples": ["ZPRV.DE", "ZPRX.DE", "5MVL.DE"],
        "isin_lookup_samples": [
            {"ticker": "IE00BSPLC298", "label": "IE00BSPLC298 (ZPRX)"},
        ],
    },
    {
        "code": "HKG",
        "name": "Hong Kong Stock Exchange",
        "samples": [
            {"ticker": "9988.HK", "label": "9988.HK (Alibaba / BABA)"},
            "1299.HK",
            "1810.HK",
        ],
        "google_query_samples": ["HKG:9988", "HKG:1299", "HKG:1810"],
        "yahoo_query_samples": [
            {"ticker": "9988.HK", "label": "9988.HK (Alibaba / BABA)"},
            "1299.HK",
            "1810.HK",
        ],
        "isin_lookup_samples": [
            {"ticker": "KYG017191142", "label": "KYG017191142 (9988.HK / Alibaba)"},
        ],
    },
    {
        "code": "TLV",
        "name": "Tel Aviv Stock Exchange",
        "samples": ["TASE.TA", "POLI.TA", "NICE.TA"],
        "google_query_samples": ["TLV:POLI", "TLV:NICE", "TLV:TEVA"],
        "yahoo_query_samples": ["POLI.TA", "NICE.TA", "TEVA.TA"],
        "isin_lookup_samples": [
            {"ticker": "IL0006625771", "label": "IL0006625771 (POLI)"},
            {"ticker": "IL0011465700", "label": "IL0011465700 (KSM.F59 ETF)"},
        ],
    },
    {
        "code": "TYO",
        "name": "Tokyo Stock Exchange",
        "samples": ["7203.T", "6758.T", "9984.T"],
        "google_query_samples": ["TYO:7203", "TYO:6758", "TYO:9984"],
        "yahoo_query_samples": ["7203.T", "6758.T", "9984.T"],
        "isin_lookup_samples": [
            {"ticker": "JP3633400001", "label": "JP3633400001 (7203.T / Toyota)"},
        ],
    },
    {
        "code": "PSE",
        "name": "Philippine Stock Exchange",
        "samples": ["PSE:AP", "PSE:CNVRG", "PSE:DMC", "PSE:GTCAP"],
        "google_query_samples": ["PSE:AP", "PSE:CNVRG", "PSE:DMC", "PSE:GTCAP"],
        "yahoo_query_samples": ["AP.PS", "CNVRG.PS", "DMC.PS", "GTCAP.PS"],
        "isin_lookup_samples": [
            {"ticker": "PHY0005M1090", "label": "PHY0005M1090 (AP)"},
        ],
    },
    {
        "code": "SGX",
        "name": "Singapore Exchange",
        "samples": ["SGX:D05", "SGX:U11", "SGX:O39"],
        "google_query_samples": ["SGX:D05", "SGX:U11", "SGX:O39"],
        "yahoo_query_samples": ["D05.SI", "U11.SI", "O39.SI"],
        "isin_lookup_samples": [
            {"ticker": "SG1L01001701", "label": "SG1L01001701 (SGX:D05)"},
        ],
    },
    {
        "code": "OTCMKTS",
        "name": "OTC Markets",
        "samples": ["OTCMKTS:RYCEY", "OTCMKTS:NSRGY", "OTCMKTS:TCEHY"],
        "google_query_samples": ["OTCMKTS:RYCEY", "OTCMKTS:NSRGY", "OTCMKTS:TCEHY"],
        "yahoo_query_samples": ["RYCEY", "NSRGY", "TCEHY"],
        "isin_lookup_samples": [
            {"ticker": "US7757812067", "label": "US7757812067 (OTCMKTS:RYCEY)"},
        ],
    },
]

EXCHANGES = sorted(EXCHANGES, key=lambda exchange: str(exchange["name"]))

QUERY_COLUMNS = [
    {
        "key": "google-query",
        "label": "Google Finance query",
        "attributes": ["name"],
        "sample_key": "google_query_samples",
        "tooltip": 'Representative exchange-prefixed inputs such as `LON:SJPA`, `TLV:POLI`, or `NASDAQ:GOOG`.',
        "example": "LON:SJPA",
    },
    {
        "key": "yahoo-query",
        "label": "Yahoo style",
        "attributes": ["name"],
        "sample_key": "yahoo_query_samples",
        "tooltip": 'Representative Yahoo-style inputs such as `SJPA.L`, `POLI.TA`, or `GOOG`.',
        "example": "SJPA.L",
    },
    {
        "key": "isin-query",
        "label": "ISIN",
        "attributes": ["name"],
        "sample_key": "isin_lookup_samples",
        "tooltip": 'Direct ISIN input such as `IE00...`, `IL00...`, or `US...`.',
        "example": "IE00B4L5YX21",
    },
]

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

QUERY_SECTION_STYLE = "text-align:center;"
FEATURE_SECTION_STYLE = "text-align:center;"
SECTION_DIVIDER_STYLE = "border-left:3px solid #6b7280;"
EXCHANGE_CELL_STYLE = "vertical-align:top;"
SAMPLES_CELL_STYLE = "text-align:center;vertical-align:top;"

DEFAULT_MAX_WORKERS = min(32, max(4, (os.cpu_count() or 4) * 4))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="generate-support-matrix.py",
        description="Generate the support-matrix page from live CLI probes.",
    )
    parser.add_argument("--details", action="store_true", help="include failing probe details")
    parser.add_argument(
        "--update-page",
        action="store_true",
        help="replace the support-matrix page block between marker comments",
    )
    parser.add_argument(
        "--update-readme",
        action="store_true",
        dest="update_page",
        help=argparse.SUPPRESS,
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
    return f'<code>{code}</code><br /><sub>{name}</sub>'


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
    attributes = "<br />".join(f"<code>{html.escape(attribute)}</code>" for attribute in feature["attributes"])
    tooltip = html.escape("Grouped attributes: " + ", ".join(feature["attributes"]), quote=True)
    return f'<span title="{tooltip}">{label}<br /><sub>{attributes}</sub></span>'


def format_query_header_cell(column: dict[str, object]) -> str:
    label = str(column["label"])
    example = html.escape(str(column["example"]))
    tooltip = html.escape(str(column["tooltip"]), quote=True)
    return f'<span title="{tooltip}">{label}<br /><sub><code>{example}</code></sub></span>'


def column_samples(exchange: dict[str, object], column: dict[str, object]) -> list[str | dict[str, str]]:
    sample_key = str(column.get("sample_key") or "samples")
    return list(exchange[sample_key])


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
        for column in QUERY_COLUMNS + FEATURES:
            feature_key = str(column["key"])
            for sample in column_samples(exchange, column):
                for attribute in column["attributes"]:
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


def evaluate_column(
    exchange: dict[str, object],
    column: dict[str, object],
    details: list[str],
    reliability_notes: list[str],
    probe_results: dict[tuple[str, str, str, str], dict[str, str | bool]],
) -> str:
    samples = column_samples(exchange, column)
    attributes = list(column["attributes"])
    exchange_code = str(exchange["code"])
    feature_key = str(column["key"])
    feature_label = str(column["label"])
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

    tooltip += f" Samples: {format_samples(samples)}"

    return format_status_cell(ICONS[status], tooltip)


def generate_matrix_body(show_details: bool) -> tuple[str, str]:
    probe_results = execute_probe_plan(build_probe_plan())
    lines = [
        "<table>",
        "  <thead>",
        "    <tr>",
        '      <th rowspan="2">{}</th>'.format(
            format_header_cell("Exchange", "Code and full venue name."),
        ),
        '      <th rowspan="2">{}</th>'.format(
            format_header_cell("Samples", "Hover the info icon to see the sample tickers used for the feature columns."),
        ),
        '      <th colspan="{}">Query</th>'.format(len(QUERY_COLUMNS)),
        '      <th colspan="{}">Attributes</th>'.format(len(FEATURES)),
        "    </tr>",
        "    <tr>",
        *[
            "      <th>{}</th>".format(format_query_header_cell(column))
            for column in QUERY_COLUMNS
        ],
        "      <th>{}</th>".format(format_feature_header_cell(FEATURES[0])),
        *[
            "      <th>{}</th>".format(format_feature_header_cell(feature))
            for feature in FEATURES[1:]
        ],
        "    </tr>",
        "  </thead>",
        "  <tbody>",
    ]
    detail_lines: list[str] = []
    reliability_notes: list[str] = []

    for exchange in EXCHANGES:
        row_lines = [
            "    <tr>",
            "      <td>{}</td>".format(format_exchange_cell(exchange)),
            "      <td>{}</td>".format(format_samples_cell(list(exchange["samples"]))),
        ]
        for column in QUERY_COLUMNS:
            row_lines.append(
                "      <td>{}</td>".format(
                    evaluate_column(
                        exchange,
                        column,
                        detail_lines if show_details else [],
                        reliability_notes,
                        probe_results,
                    ),
                )
            )
        for index, feature in enumerate(FEATURES):
            row_lines.append(
                "      <td>{}</td>".format(
                    evaluate_column(
                        exchange,
                        feature,
                        detail_lines if show_details else [],
                        reliability_notes,
                        probe_results,
                    ),
                )
            )
        row_lines.append("    </tr>")
        lines.extend(row_lines)

    lines.append("  </tbody>")
    lines.append("</table>")
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


def render_support_matrix_page(generated_block: str) -> str:
    body = generated_block.rstrip()
    return "\n".join([
        "---",
        "sidebar_position: 3",
        "---",
        "",
        "# Support Matrix",
        "",
        "This matrix is sample-based, not exhaustive. It is intended to show current practical coverage of the public interface, not a formal guarantee for every symbol on an exchange.",
        "",
        "Use it as a quick reference for current live probe results by exchange and feature group.",
        "",
        body,
        "",
    ])


def update_support_matrix_page(generated_block: str) -> None:
    SUPPORT_MATRIX_PATH.write_text(render_support_matrix_page(generated_block), encoding="utf8")


def main() -> int:
    args = parse_args()
    output = generate_output(args.details)

    if args.update_page:
        update_support_matrix_page(output)
        print(f"Updated support matrix in {SUPPORT_MATRIX_PATH}")
        return 0

    print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
