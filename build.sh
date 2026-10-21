#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/upstream/godot/SConstruct" ]]; then
  git submodule update --init --depth 1 -- upstream/godot
fi

PYTHON="${PYTHON:-python3}"
"$PYTHON" "$ROOT/tools/integrate.py" --engine "$ROOT/upstream/godot"

ENGINE="$ROOT/upstream/godot"
CUSTOM_MODULE="$ROOT/integration/modules/psych_engine"
JOBS="${JOBS:-2}"
cd "$ENGINE"
exec scons platform=linuxbsd target=editor dev_build=no optimize=speed -j"$JOBS" "custom_modules=$CUSTOM_MODULE" "$@"
