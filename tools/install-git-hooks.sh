#!/bin/sh
# SPDX-License-Identifier: MPL-2.0


set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

git -C "$ROOT_DIR" config core.hooksPath .githooks

echo "Configured git hooks to use $ROOT_DIR/.githooks"
