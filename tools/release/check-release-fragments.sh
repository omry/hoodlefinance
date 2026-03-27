#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
CHANGES_DIR=${1:-"$ROOT_DIR/changes.d"}

if [ ! -d "$CHANGES_DIR" ]; then
  echo "Error: changes directory not found: $CHANGES_DIR" >&2
  exit 1
fi

fragment_count=0

for fragment_path in "$CHANGES_DIR"/*; do
  [ -e "$fragment_path" ] || continue

  file_name=$(basename -- "$fragment_path")

  if [ -d "$fragment_path" ]; then
    continue
  fi

  case "$file_name" in
    .gitkeep|README.md|TEMPLATE.md)
      continue
      ;;
  esac

  case "$file_name" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[a-z0-9][a-z0-9-]*.upgrade.md|\
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[a-z0-9][a-z0-9-]*.added.md|\
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[a-z0-9][a-z0-9-]*.changed.md|\
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[a-z0-9][a-z0-9-]*.docs.md|\
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[a-z0-9][a-z0-9-]*.fixed.md)
      ;;
    *)
      echo "Error: Invalid release fragment filename: $file_name. Expected YYYYMMDD-short-change-name.<upgrade|added|changed|docs|fixed>.md." >&2
      exit 1
      ;;
  esac

  awk_status=0
  awk '
    {
      sub(/\r$/, "", $0)
      if ($0 ~ /[^[:space:]]/) {
        if (!seen_nonempty) {
          first_nonempty = $0
          seen_nonempty = 1
        }
      }
      if ($0 ~ /^- /) {
        bullet_count += 1
      }
    }
    END {
      if (!seen_nonempty) {
        exit 10
      }
      if (first_nonempty !~ /^- /) {
        exit 11
      }
      if (bullet_count != 1) {
        exit 12
      }
    }
  ' "$fragment_path" || awk_status=$?

  case "$awk_status" in
    0)
      ;;
    10)
      echo "Error: Release fragment $file_name is empty." >&2
      exit 1
      ;;
    11)
      echo "Error: Release fragment $file_name must start with a single '- ' bullet line." >&2
      exit 1
      ;;
    12)
      echo "Error: Release fragment $file_name must contain exactly one top-level bullet." >&2
      exit 1
      ;;
    *)
      echo "Error: Failed to validate release fragment $file_name." >&2
      exit 1
      ;;
  esac

  fragment_count=$((fragment_count + 1))
done

if [ "$fragment_count" -eq 1 ]; then
  suffix=""
else
  suffix="s"
fi

echo "Validated $fragment_count release fragment$suffix."
