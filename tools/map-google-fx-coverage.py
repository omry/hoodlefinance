#!/usr/bin/env python3

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import gzip
import http.client
import json
import os
import re
import socket
import ssl
import sys
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CODES_PATH = ROOT_DIR / "data" / "currency-codes.json"
DEFAULT_OUTPUT_ROOT = ROOT_DIR / "tmp" / "fx-pair-coverage"
DEFAULT_MAX_WORKERS = min(64, max(8, (os.cpu_count() or 4) * 4))

GOOGLE_FX_URL = "https://www.google.com/finance/quote/{pair_slug}"
GOOGLE_FX_HOST = "www.google.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/134.0.0.0 Safari/537.36"
)
TLS_CONTEXT = ssl.create_default_context()
THREAD_LOCAL = threading.local()

CALLBACK_PATTERN = re.compile(r"AF_initDataCallback\(([\s\S]*?)\);\s*</script>", re.IGNORECASE)
DATA_PATTERN = re.compile(r"data:(\[[\s\S]*?\]),\s*sideChannel:", re.IGNORECASE)
TITLE_PATTERN = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="map-google-fx-coverage.py",
        description="Probe Google Finance FX page coverage for the full canonical currency/crypto pair set.",
    )
    parser.add_argument(
        "--codes-path",
        type=Path,
        default=DEFAULT_CODES_PATH,
        help="path to data/currency-codes.json",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help="directory where timestamped run outputs should be written",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=DEFAULT_MAX_WORKERS,
        help="number of parallel HTTP probes to run",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="per-request timeout in seconds",
    )
    parser.add_argument(
        "--codes",
        help="optional comma-separated subset of 3- or 4-character codes to build the matrix from",
    )
    parser.add_argument(
        "--pairs",
        help="optional comma-separated list of explicit directed pairs such as EURUSD,DOGEUSD,USDT.USD",
    )
    parser.add_argument(
        "--no-progress",
        action="store_true",
        help="disable live progress output",
    )
    return parser.parse_args()


def load_code_set(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    canonical_codes = [str(code).strip().upper() for code in payload.get("canonicalCodes", [])]
    crypto_codes = [str(code).strip().upper() for code in payload.get("cryptoCodes", [])]
    codes = []
    seen = set()

    for code in canonical_codes + crypto_codes:
        if re.fullmatch(r"[A-Z]{3,4}", code) and code not in seen:
            seen.add(code)
            codes.append(code)

    if not codes:
        raise ValueError(f"No valid 3- or 4-character codes were found in {path}.")

    return codes


def parse_code_filter(text: str | None, known_codes: set[str]) -> list[str]:
    if not text:
        return sorted(known_codes)

    codes = []
    for raw in text.split(","):
        code = raw.strip().upper()
        if not code:
            continue
        if code not in known_codes:
            raise ValueError(f"Unknown code in --codes: {code}")
        codes.append(code)

    if not codes:
        raise ValueError("--codes did not contain any valid 3- or 4-character codes.")

    return sorted(dict.fromkeys(codes))


def normalize_pair(base: str, quote: str) -> str:
    return base + quote if len(base) == 3 and len(quote) == 3 else base + "." + quote


def split_pair(pair: str, known_codes: set[str]) -> tuple[str, str]:
    if "." in pair:
        parts = pair.split(".", 1)
        if len(parts) != 2 or parts[0] not in known_codes or parts[1] not in known_codes:
            raise ValueError(f"Pair in --pairs uses unknown code(s): {pair}")
        return parts[0], parts[1]

    if not re.fullmatch(r"[A-Z]{6,8}", pair):
        raise ValueError(f"Invalid pair in --pairs: {pair}")

    candidates = []
    for base_len in (3, 4):
        quote_len = len(pair) - base_len
        if quote_len < 3 or quote_len > 4:
            continue
        base = pair[:base_len]
        quote = pair[base_len:]
        if base in known_codes and quote in known_codes:
            candidates.append((base, quote))

    if not candidates:
        raise ValueError(f"Pair in --pairs uses unknown code(s): {pair}")

    if len(candidates) > 1:
        suggestions = " or ".join(normalize_pair(base, quote) for base, quote in candidates[:2])
        raise ValueError(f"Pair in --pairs is ambiguous: {pair}. Use {suggestions}.")

    return candidates[0]


def parse_pair_filter(text: str | None, known_codes: set[str]) -> list[str] | None:
    if not text:
        return None

    pairs = []
    for raw in text.split(","):
        pair = raw.strip().upper()
        if not pair:
            continue
        base, quote = split_pair(pair, known_codes)
        pairs.append(normalize_pair(base, quote))

    if not pairs:
        raise ValueError("--pairs did not contain any valid directed pairs.")

    return list(dict.fromkeys(pairs))


def build_pair_list(codes: list[str], explicit_pairs: list[str] | None) -> list[str]:
    if explicit_pairs is not None:
        return explicit_pairs

    return [normalize_pair(base, quote) for base in codes for quote in codes]


def extract_html_title(text: str) -> str:
    match = TITLE_PATTERN.search(text or "")
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def find_pair_tuple(value: Any, pair_slug: str) -> list[Any] | None:
    if not isinstance(value, list):
        return None

    if pair_slug in value:
        return value

    for item in value:
        nested = find_pair_tuple(item, pair_slug)
        if nested is not None:
            return nested

    return None


def extract_google_fx_price(html_text: str, pair_slug: str) -> float:
    for callback_text in CALLBACK_PATTERN.findall(html_text or ""):
        data_match = DATA_PATTERN.search(callback_text)
        if not data_match:
            continue

        try:
            data = json.loads(data_match.group(1))
        except json.JSONDecodeError:
            continue

        tuple_value = find_pair_tuple(data, pair_slug)
        if tuple_value is None:
            continue

        market_data = tuple_value[5] if len(tuple_value) > 5 and isinstance(tuple_value[5], list) else []
        current_price = market_data[0] if market_data else None

        try:
            return float(current_price)
        except (TypeError, ValueError):
            raise ValueError(f'Google Finance found "{pair_slug}" but did not expose a numeric current price.')

    raise ValueError(f'Google Finance did not expose a quote tuple for "{pair_slug}".')


def close_google_connection() -> None:
    connection = getattr(THREAD_LOCAL, "google_connection", None)
    if connection is None:
        return

    try:
        connection.close()
    except OSError:
        pass

    THREAD_LOCAL.google_connection = None


def get_google_connection(timeout: float) -> http.client.HTTPSConnection:
    connection = getattr(THREAD_LOCAL, "google_connection", None)

    if connection is None or getattr(connection, "sock", None) is None:
        connection = http.client.HTTPSConnection(
            GOOGLE_FX_HOST,
            timeout=timeout,
            context=TLS_CONTEXT,
        )
        THREAD_LOCAL.google_connection = connection
    elif connection.sock is not None:
        connection.sock.settimeout(timeout)

    return connection


def decode_http_body(response: http.client.HTTPResponse, raw_body: bytes) -> str:
    content_encoding = (response.getheader("Content-Encoding") or "").lower()

    if "gzip" in content_encoding:
        raw_body = gzip.decompress(raw_body)

    return raw_body.decode("utf-8", errors="replace")


def fetch_google_quote_page(pair_slug: str, timeout: float) -> tuple[int, str]:
    path = "/finance/quote/" + quote(pair_slug)
    headers = {
        "Accept-Encoding": "gzip",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Host": GOOGLE_FX_HOST,
        "User-Agent": USER_AGENT,
    }
    last_error: Exception | None = None

    for _attempt in range(2):
        connection = get_google_connection(timeout)

        try:
            connection.request("GET", path, headers=headers)
            response = connection.getresponse()
            raw_body = response.read()
            status_code = int(response.status)
            body = decode_http_body(response, raw_body)
            return status_code, body
        except (
            EOFError,
            OSError,
            gzip.BadGzipFile,
            http.client.HTTPException,
            socket.timeout,
            ssl.SSLError,
        ) as error:
            last_error = error
            close_google_connection()

    if last_error is None:
        last_error = RuntimeError(f"Unknown Google fetch failure for {pair_slug}")

    raise last_error


def probe_pair(pair: str, timeout: float) -> dict[str, Any]:
    base, quote = pair.split(".", 1) if "." in pair else (pair[:3], pair[3:])
    pair_slug = base + "-" + quote
    url = GOOGLE_FX_URL.format(pair_slug=pair_slug)

    if base == quote:
        return {
            "base": base,
            "pair": pair,
            "pair_slug": pair_slug,
            "price": 1.0,
            "quote": quote,
            "reason": "same_currency_local",
            "status": "local",
            "status_code": 0,
            "title": "",
            "url": url,
        }

    try:
        status_code, content = fetch_google_quote_page(pair_slug, timeout)
    except Exception as error:
        return {
            "base": base,
            "pair": pair,
            "pair_slug": pair_slug,
            "price": "",
            "quote": quote,
            "reason": f"transport_error: {error}",
            "status": "error",
            "status_code": "",
            "title": "",
            "url": url,
        }

    if status_code != 200:
        return {
            "base": base,
            "pair": pair,
            "pair_slug": pair_slug,
            "price": "",
            "quote": quote,
            "reason": f"http_{status_code}",
            "status": "missing",
            "status_code": int(status_code),
            "title": extract_html_title(content),
            "url": url,
        }

    try:
        price = extract_google_fx_price(content, pair_slug)
    except ValueError as error:
        return {
            "base": base,
            "pair": pair,
            "pair_slug": pair_slug,
            "price": "",
            "quote": quote,
            "reason": str(error),
            "status": "missing",
            "status_code": int(status_code),
            "title": extract_html_title(content),
            "url": url,
        }

    return {
        "base": base,
        "pair": pair,
        "pair_slug": pair_slug,
        "price": price,
        "quote": quote,
        "reason": "",
        "status": "supported",
        "status_code": int(status_code),
        "title": extract_html_title(content),
        "url": url,
    }


def write_outputs(output_dir: Path, results: list[dict[str, Any]], codes: list[str]) -> None:
    supported = [row for row in results if row["status"] == "supported"]
    missing = [row for row in results if row["status"] == "missing"]
    local = [row for row in results if row["status"] == "local"]
    errors = [row for row in results if row["status"] == "error"]

    summary = {
        "codes": codes,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "missing_count": len(missing),
        "missing_pairs": [row["pair"] for row in missing],
        "output_dir": str(output_dir),
        "pair_count": len(results),
        "supported_count": len(supported),
        "local_count": len(local),
        "error_count": len(errors),
        "error_pairs": [row["pair"] for row in errors],
    }

    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (output_dir / "missing-pairs.txt").write_text(
        "\n".join(row["pair"] for row in missing) + ("\n" if missing else ""),
        encoding="utf-8",
    )
    (output_dir / "error-pairs.txt").write_text(
        "\n".join(f"{row['pair']}\t{row['reason']}" for row in errors) + ("\n" if errors else ""),
        encoding="utf-8",
    )
    (output_dir / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")

    with (output_dir / "results.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["pair", "base", "quote", "pair_slug", "status", "status_code", "price", "reason", "title", "url"],
        )
        writer.writeheader()
        writer.writerows(results)


def count_statuses(results: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "supported": sum(1 for row in results if row["status"] == "supported"),
        "missing": sum(1 for row in results if row["status"] == "missing"),
        "local": sum(1 for row in results if row["status"] == "local"),
        "error": sum(1 for row in results if row["status"] == "error"),
    }


def render_progress_line(completed: int, total: int, counts: dict[str, int], width: int = 28) -> str:
    ratio = 1.0 if total <= 0 else completed / total
    filled = width if ratio >= 1 else int(width * ratio)
    bar = "#" * filled + "-" * max(0, width - filled)
    return (
        f"[{bar}] {completed}/{total} "
        f"supported={counts['supported']} missing={counts['missing']} "
        f"local={counts['local']} errors={counts['error']}"
    )


def print_progress_start(total: int, max_workers: int) -> None:
    sys.stderr.write(f"Probing {total} Google FX pairs with {max_workers} workers.\n")
    sys.stderr.flush()


def maybe_print_progress(
    completed: int,
    total: int,
    counts: dict[str, int],
    is_tty: bool,
    force: bool,
    last_line_state: dict[str, Any],
) -> None:
    if total <= 0:
        return

    now = time.monotonic()
    line = render_progress_line(completed, total, counts)

    if is_tty:
        if not force and (completed < total) and (now - last_line_state["time"] < 0.1):
            return
        sys.stderr.write("\r" + line)
        if force:
            sys.stderr.write("\n")
        sys.stderr.flush()
        last_line_state["time"] = now
        last_line_state["line"] = line
        return

    step = max(1, total // 20)
    should_print = force or completed == 1 or completed == total or completed - last_line_state["completed"] >= step

    if force and last_line_state.get("line") == line:
        return

    if should_print:
        sys.stderr.write(line + "\n")
        sys.stderr.flush()
        last_line_state["completed"] = completed
        last_line_state["time"] = now
        last_line_state["line"] = line


def print_summary(output_dir: Path, results: list[dict[str, Any]]) -> None:
    counts = count_statuses(results)

    sys.stdout.write(
        "Google FX coverage probe complete.\n"
        f"Supported: {counts['supported']}\n"
        f"Missing:   {counts['missing']}\n"
        f"Local:     {counts['local']}\n"
        f"Errors:    {counts['error']}\n"
        f"Output:    {output_dir}\n"
    )

    if counts["missing"]:
        sys.stdout.write(f"Missing pairs list: {output_dir / 'missing-pairs.txt'}\n")
    if counts["error"]:
        sys.stdout.write(f"Error pairs list:   {output_dir / 'error-pairs.txt'}\n")


def main() -> int:
    args = parse_args()
    known_codes = load_code_set(args.codes_path)
    known_code_set = set(known_codes)
    selected_codes = parse_code_filter(args.codes, known_code_set)
    explicit_pairs = parse_pair_filter(args.pairs, known_code_set)
    pairs = build_pair_list(selected_codes, explicit_pairs)

    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_dir = args.output_root / run_stamp
    output_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict[str, Any]] = []
    progress_counts = {
        "supported": 0,
        "missing": 0,
        "local": 0,
        "error": 0,
    }
    progress_enabled = not args.no_progress
    is_tty = sys.stderr.isatty()
    progress_state = {
        "completed": 0,
        "line": "",
        "time": 0.0,
    }
    total_pairs = len(pairs)

    if progress_enabled:
        print_progress_start(total_pairs, args.max_workers)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_workers) as executor:
        future_to_pair = {
            executor.submit(probe_pair, pair, args.timeout): pair
            for pair in pairs
        }
        for future in concurrent.futures.as_completed(future_to_pair):
            result = future.result()
            results.append(result)
            progress_counts[result["status"]] += 1
            progress_state["completed"] += 1

            if progress_enabled:
                maybe_print_progress(
                    progress_state["completed"],
                    total_pairs,
                    progress_counts,
                    is_tty=is_tty,
                    force=False,
                    last_line_state=progress_state,
                )

    if progress_enabled:
        maybe_print_progress(
            progress_state["completed"],
            total_pairs,
            progress_counts,
            is_tty=is_tty,
            force=True,
            last_line_state=progress_state,
        )

    results.sort(key=lambda row: row["pair"])
    write_outputs(
        output_dir,
        results,
        selected_codes if explicit_pairs is None else sorted({row["base"] for row in results} | {row["quote"] for row in results}),
    )
    print_summary(output_dir, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
