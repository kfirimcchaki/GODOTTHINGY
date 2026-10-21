#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
GODOT_BIN="${GODOT_BIN:-$ROOT/upstream/godot/bin/godot.linuxbsd.editor.x86_64}"

if [[ ! -x "$GODOT_BIN" ]]; then
  echo "Set GODOT_BIN to the built editor executable (not found: $GODOT_BIN)." >&2
  exit 2
fi

exec "$GODOT_BIN" --headless --path "$ROOT/tests/godot" --script "$ROOT/tests/godot/test_psych_native.gd"
