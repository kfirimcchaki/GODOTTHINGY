#!/usr/bin/env python3
"""Apply the small pinned Project Manager patch for the custom native Psych module."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_RELATIVE = Path("upstream/godot")
EXPECTED_GODOT_COMMIT = "ed1daf0bf001b61586d9930840f2f1394092c079"
MODULE_SOURCE = ROOT / "integration" / "modules" / "psych_engine"
PATCH_FILE = ROOT / "integration" / "patches" / "godot-4.7.2-project-xml-import.patch"
PATCH_MARKER = "psych_project = false;"


class IntegrationError(RuntimeError):
    pass


def run_git(engine: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", "-C", str(engine), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode:
        raise IntegrationError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result


def ensure_engine_checkout(engine: Path, strict_revision: bool = True) -> None:
    if not (engine / "SConstruct").is_file() or not (engine / "version.py").is_file():
        raise IntegrationError(
            f"Godot source is missing at {engine}. Run 'git submodule update --init --depth 1 upstream/godot' first."
        )
    rev = run_git(engine, "rev-parse", "HEAD", check=False)
    if rev.returncode == 0:
        actual = rev.stdout.strip()
        if strict_revision and actual != EXPECTED_GODOT_COMMIT:
            raise IntegrationError(
                "This overlay is pinned to Godot 4.7.2-stable "
                f"({EXPECTED_GODOT_COMMIT[:12]}), but {engine} is at {actual[:12]}. "
                "Use the pinned submodule revision or deliberately update the compatibility patch."
            )
    elif strict_revision:
        raise IntegrationError("The Godot source must be a Git checkout so the pinned patch can be applied safely.")


def is_patch_applied(engine: Path) -> bool:
    source = engine / "editor" / "project_manager" / "project_dialog.cpp"
    header = engine / "editor" / "project_manager" / "project_dialog.h"
    if not source.is_file() or not header.is_file():
        return False
    return PATCH_MARKER in source.read_text(encoding="utf-8") and "bool psych_project = false;" in header.read_text(encoding="utf-8")


def apply_project_manager_patch(engine: Path, check_only: bool) -> None:
    if is_patch_applied(engine):
        return
    if check_only:
        raise IntegrationError("Project.xml Project Manager patch is not applied.")
    check = run_git(engine, "apply", "--check", str(PATCH_FILE), check=False)
    if check.returncode:
        raise IntegrationError(
            "The Project.xml patch does not apply cleanly. The Godot source may have local edits or may not match 4.7.2-stable.\n"
            + check.stderr.strip()
        )
    applied = run_git(engine, "apply", str(PATCH_FILE), check=False)
    if applied.returncode:
        raise IntegrationError("Could not apply the Project.xml Project Manager patch.\n" + applied.stderr.strip())


def verify_module_source() -> None:
    required = ("config.py", "SCsub", "register_types.h", "register_types.cpp", "psych_conductor.h", "psych_project_descriptor.h")
    missing = [name for name in required if not (MODULE_SOURCE / name).is_file()]
    if missing:
        raise IntegrationError("Native module source is incomplete; missing: " + ", ".join(missing))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, default=ROOT / ENGINE_RELATIVE, help="Godot source checkout")
    parser.add_argument("--check", action="store_true", help="verify that the patch and module sources are ready")
    parser.add_argument("--allow-other-revision", action="store_true", help="skip the exact upstream commit check (not recommended)")
    args = parser.parse_args()

    engine = args.engine.expanduser().resolve()
    try:
        ensure_engine_checkout(engine, strict_revision=not args.allow_other_revision)
        verify_module_source()
        apply_project_manager_patch(engine, check_only=args.check)
    except IntegrationError as exc:
        print(f"integration error: {exc}", file=sys.stderr)
        return 2

    action = "verified" if args.check else "applied"
    print(f"Project.xml Project Manager patch {action} in {engine}")
    print("Native module source:", MODULE_SOURCE.relative_to(ROOT))
    print("SCons option: custom_modules=" + str(MODULE_SOURCE))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
