#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI_PATH="$ROOT_DIR/tools/cli.js"
README_PATH="$ROOT_DIR/README.md"
MARKER_START="<!-- SUPPORT_MATRIX:START -->"
MARKER_END="<!-- SUPPORT_MATRIX:END -->"
SHOW_DETAILS=0
UPDATE_README=0

for arg in "$@"; do
  case "$arg" in
    --details)
      SHOW_DETAILS=1
      ;;
    --update-readme)
      UPDATE_README=1
      ;;
    *)
      echo "Usage: ./tools/generate-support-matrix.sh [--details] [--update-readme]" >&2
      exit 1
      ;;
  esac
done

declare -a EXCHANGES=(
  "PSE|PSE:BDO,PSE:AAA"
  "LON|SJPA.L,CPXJ.L"
  "ETR|ZPRV.DE,ZPRX.DE,5MVL.DE"
  "NASDAQ|GOOG,AAPL"
  "NYSE|NYSE:IBM,NYSE:KO"
  "TYO|7203.T"
)

declare -a FEATURES=(
  "quote|Quote attrs"
  "isin|\`isin\`"
  "native-isin|Native \`*:isin\`"
  "tradingview-isin|\`tradingview:isin\`"
  "ibkr-isin|\`ibkr:isin\`"
)

DETAILS=""

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

format_samples() {
  local samples_csv="$1"
  local -a samples=()
  local sample
  local old_ifs="$IFS"
  local formatted=""

  IFS=',' read -r -a samples <<< "$samples_csv"
  IFS="$old_ifs"

  for sample in "${samples[@]}"; do
    sample="$(trim "$sample")"
    if [[ -n "$formatted" ]]; then
      formatted+=", "
    fi
    formatted+="$sample"
  done

  printf '%s' "$formatted"
}

feature_attrs() {
  local exchange="$1"
  local feature_key="$2"

  case "$feature_key" in
    quote)
      printf '%s\n' "price" "name" "currency"
      ;;
    isin)
      printf '%s\n' "isin"
      ;;
    native-isin)
      case "$exchange" in
        ETR)
          printf '%s\n' "ariva:isin"
          ;;
        LON)
          printf '%s\n' "lon:isin"
          ;;
        PSE)
          printf '%s\n' "pse:isin"
          ;;
      esac
      ;;
    tradingview-isin)
      printf '%s\n' "tradingview:isin"
      ;;
    ibkr-isin)
      printf '%s\n' "ibkr:isin"
      ;;
  esac
}

run_probe() {
  local ticker="$1"
  local attribute="$2"
  local stdout_file
  local stderr_file
  local status
  local stdout_text
  local stderr_text

  stdout_file="$(mktemp)"
  stderr_file="$(mktemp)"

  if node "$CLI_PATH" "$ticker" "$attribute" >"$stdout_file" 2>"$stderr_file"; then
    status=0
  else
    status=$?
  fi

  stdout_text="$(<"$stdout_file")"
  stderr_text="$(<"$stderr_file")"
  rm -f "$stdout_file" "$stderr_file"

  stdout_text="$(trim "$stdout_text")"
  stderr_text="$(trim "$stderr_text")"

  if [[ $status -eq 0 && -n "$stdout_text" ]]; then
    printf 'ok\t%s\t%s\n' "$stdout_text" ""
    return
  fi

  if [[ -z "$stderr_text" ]]; then
    stderr_text="failed"
  fi

  printf 'fail\t%s\t%s\n' "$stdout_text" "$stderr_text"
}

append_detail_header() {
  local header="$1"

  if [[ $SHOW_DETAILS -ne 1 ]]; then
    return
  fi

  if [[ -n "$DETAILS" ]]; then
    DETAILS+=$'\n'
  fi

  DETAILS+="### $header"$'\n'
}

append_detail_line() {
  local line="$1"

  if [[ $SHOW_DETAILS -ne 1 ]]; then
    return
  fi

  DETAILS+="- $line"$'\n'
}

evaluate_feature() {
  local exchange="$1"
  local samples_csv="$2"
  local feature_key="$3"
  local feature_label="$4"
  local attrs_text
  local -a attrs=()
  local -a samples=()
  local sample
  local attr
  local result_line
  local status_tag
  local error_text
  local total=0
  local ok_count=0
  local has_failures=0
  local old_ifs="$IFS"

  attrs_text="$(feature_attrs "$exchange" "$feature_key")"
  if [[ -n "$attrs_text" ]]; then
    while IFS= read -r attr; do
      [[ -n "$attr" ]] && attrs+=("$attr")
    done <<< "$attrs_text"
  fi

  if [[ ${#attrs[@]} -eq 0 ]]; then
    printf '❌'
    return
  fi

  IFS=',' read -r -a samples <<< "$samples_csv"
  IFS="$old_ifs"

  for sample in "${samples[@]}"; do
    sample="$(trim "$sample")"
    for attr in "${attrs[@]}"; do
      result_line="$(run_probe "$sample" "$attr")"
      status_tag="${result_line%%$'\t'*}"
      error_text="${result_line##*$'\t'}"
      total=$((total + 1))

      if [[ "$status_tag" == "ok" ]]; then
        ok_count=$((ok_count + 1))
      else
        if [[ $has_failures -eq 0 ]]; then
          append_detail_header "$exchange / $feature_label"
          has_failures=1
        fi
        append_detail_line "\`$sample\` + \`$attr\` -> $error_text"
      fi
    done
  done

  if [[ $ok_count -eq $total ]]; then
    printf '✅'
    return
  fi

  if [[ $ok_count -eq 0 ]]; then
    printf '❌'
    return
  fi

  printf '⚠️'
}

generate_matrix_body() {
  local output=""
  local exchange_entry
  local exchange_name
  local sample_csv
  local sample_display
  local feature
  local feature_key
  local feature_label
  local icon

  output+='| Exchange | Samples |'
  for feature in "${FEATURES[@]}"; do
    output+=" ${feature#*|} |"
  done
  output+=$'\n'

  output+='| --- | --- |'
  for _feature in "${FEATURES[@]}"; do
    output+=' --- |'
  done
  output+=$'\n'

  for exchange_entry in "${EXCHANGES[@]}"; do
    exchange_name="${exchange_entry%%|*}"
    sample_csv="${exchange_entry#*|}"
    sample_display="$(format_samples "$sample_csv")"

    output+="| $exchange_name | \`$sample_display\` |"
    for feature in "${FEATURES[@]}"; do
      feature_key="${feature%%|*}"
      feature_label="${feature#*|}"
      icon="$(evaluate_feature "$exchange_name" "$sample_csv" "$feature_key" "$feature_label")"
      output+=" $icon |"
    done
    output+=$'\n'
  done

  output+=$'\n'
  output+='Legend: `✅` all probes passed, `⚠️` mixed results, `❌` no probes passed or no implementation is configured.'
  printf '%s' "$output"
}

generate_output() {
  local body
  body="$(generate_matrix_body)"

  printf 'Current generated matrix:\n\n%s\n' "$body"

  if [[ $SHOW_DETAILS -eq 1 && -n "$DETAILS" ]]; then
    printf '\n%s' "$DETAILS"
  fi
}

update_readme() {
  local generated_block="$1"
  local tmp_file

  if ! grep -Fq "$MARKER_START" "$README_PATH" || ! grep -Fq "$MARKER_END" "$README_PATH"; then
    echo "README markers not found in $README_PATH" >&2
    exit 1
  fi

  tmp_file="$(mktemp)"

  awk -v start="$MARKER_START" -v end="$MARKER_END" -v block="$generated_block" '
    BEGIN {
      in_block = 0
    }
    $0 == start {
      print
      print block
      in_block = 1
      next
    }
    $0 == end {
      in_block = 0
      print
      next
    }
    !in_block {
      print
    }
  ' "$README_PATH" > "$tmp_file"

  mv "$tmp_file" "$README_PATH"
}

main() {
  local output

  output="$(generate_output)"

  if [[ $UPDATE_README -eq 1 ]]; then
    update_readme "$output"
    echo "Updated README support matrix in $README_PATH"
    return
  fi

  printf '%s\n' "$output"
}

main
