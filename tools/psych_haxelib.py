#!/usr/bin/env python3
"""Inspect the Haxe libraries declared by a Psych Engine Project.xml; install only on explicit request."""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

MAX_XML_BYTES = 8 * 1024 * 1024
TOKEN_RE = re.compile(r"\s*(\|\||&&|!|\(|\)|[A-Za-z0-9_][A-Za-z0-9_.-]*)")


class ManifestError(ValueError):
    pass


class ConditionParser:
    """Small safe evaluator for the boolean syntax used by Lime Project.xml conditions."""

    def __init__(self, expression: str, symbols: dict[str, bool]):
        self.symbols = symbols
        self.tokens = self._tokenize(expression)
        self.index = 0

    @staticmethod
    def _tokenize(expression: str) -> list[str]:
        tokens: list[str] = []
        cursor = 0
        while cursor < len(expression):
            match = TOKEN_RE.match(expression, cursor)
            if not match:
                if expression[cursor:].strip() == "":
                    break
                raise ManifestError(f"Unsupported condition syntax near: {expression[cursor:]!r}")
            tokens.append(match.group(1))
            cursor = match.end()
        return tokens

    def evaluate(self) -> bool:
        if not self.tokens:
            return True
        result = self._parse_or()
        if self.index != len(self.tokens):
            raise ManifestError(f"Unexpected token in condition: {self.tokens[self.index]!r}")
        return result

    def _parse_or(self) -> bool:
        value = self._parse_and()
        while self._peek() == "||":
            self.index += 1
            right = self._parse_and()
            value = value or right
        return value

    def _parse_and(self) -> bool:
        value = self._parse_unary()
        while self.index < len(self.tokens):
            token = self._peek()
            if token == "&&":
                self.index += 1
                value = self._parse_unary() and value
            elif token in ("||", ")"):
                break
            else:
                # Lime also accepts adjacent symbols as an implicit AND, e.g. "desktop release".
                value = self._parse_unary() and value
        return value

    def _parse_unary(self) -> bool:
        token = self._peek()
        if token == "!":
            self.index += 1
            return not self._parse_unary()
        if token == "(":
            self.index += 1
            value = self._parse_or()
            if self._peek() != ")":
                raise ManifestError("Unclosed parenthesis in condition.")
            self.index += 1
            return value
        if token in (None, "&&", "||", ")"):
            raise ManifestError(f"Expected a feature name in condition near token {token!r}.")
        self.index += 1
        return bool(self.symbols.get(token, False))

    def _peek(self) -> str | None:
        return self.tokens[self.index] if self.index < len(self.tokens) else None


def evaluate_conditions(expressions: list[tuple[str, str]], symbols: dict[str, bool]) -> bool:
    for kind, expression in expressions:
        if not expression.strip():
            continue
        value = ConditionParser(expression, symbols).evaluate()
        if kind == "unless":
            value = not value
        if not value:
            return False
    return True


def host_target() -> str:
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform == "darwin":
        return "mac"
    if sys.platform.startswith("linux"):
        return "linux"
    return "linux"


def base_symbols(target: str, build: str, official_build: bool, bits32: bool) -> dict[str, bool]:
    symbols = {
        "windows": target == "windows",
        "linux": target == "linux",
        "mac": target == "mac",
        "android": target == "android",
        "ios": target == "ios",
        "html5": target == "html5",
        "web": target == "html5",
        "desktop": target in {"windows", "linux", "mac"},
        "mobile": target in {"android", "ios"},
        "debug": build == "debug",
        "release": build == "release",
        "officialBuild": official_build,
        "32bits": bits32,
    }
    return symbols


def _condition_stack(ancestors: tuple[ET.Element, ...], own: ET.Element | None = None) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for element in (*ancestors, *((own,) if own is not None else ())):
        if element.tag == "section":
            if element.get("if"):
                result.append(("if", element.get("if", "")))
            if element.get("unless"):
                result.append(("unless", element.get("unless", "")))
    if own is not None and own.tag != "section":
        if own.get("if"):
            result.append(("if", own.get("if", "")))
        if own.get("unless"):
            result.append(("unless", own.get("unless", "")))
    return result


def walk_with_sections(node: ET.Element, sections: tuple[ET.Element, ...] = ()):
    for child in list(node):
        next_sections = sections + ((child,) if child.tag == "section" else ())
        yield child, sections
        yield from walk_with_sections(child, next_sections)


def collect_dependencies(
    manifest: Path,
    target: str,
    build: str,
    official_build: bool,
    bits32: bool,
    extra_defines: tuple[str, ...] = (),
) -> tuple[ET.Element, list[dict[str, str]], dict[str, bool]]:
    if not manifest.is_file():
        raise ManifestError(f"Project.xml not found: {manifest}")
    if manifest.stat().st_size > MAX_XML_BYTES:
        raise ManifestError(f"Project.xml exceeds the {MAX_XML_BYTES // 1024 // 1024} MiB safety limit.")
    try:
        root = ET.parse(manifest).getroot()
    except ET.ParseError as exc:
        raise ManifestError(f"Invalid Project.xml: {exc}") from exc
    if root.tag != "project":
        raise ManifestError("The XML root element must be <project>.")

    symbols = base_symbols(target, build, official_build, bits32)
    for name in extra_defines:
        symbols[name] = True
    define_entries: list[tuple[str, list[tuple[str, str]]]] = []
    for element, ancestors in walk_with_sections(root):
        if element.tag == "define" and element.get("name"):
            define_entries.append((element.get("name", ""), _condition_stack(ancestors, element)))

    # Definitions can refer to earlier or later definitions; iterate to a fixed point.
    for _ in range(len(define_entries) + 1):
        changed = False
        for name, conditions in define_entries:
            if symbols.get(name, False):
                continue
            if evaluate_conditions(conditions, symbols):
                symbols[name] = True
                changed = True
        if not changed:
            break

    dependencies: dict[str, dict[str, str]] = {}
    for element, ancestors in walk_with_sections(root):
        if element.tag != "haxelib":
            continue
        name = (element.get("name") or "").strip()
        if not name:
            raise ManifestError("A <haxelib> declaration has an empty or missing name.")
        conditions = _condition_stack(ancestors, element)
        if not evaluate_conditions(conditions, symbols):
            continue
        version = (element.get("version") or "").strip()
        record = {
            "name": name,
            "version": version,
            "condition": " && ".join(f"{kind}={expression}" for kind, expression in conditions),
        }
        if name in dependencies and dependencies[name]["version"] != version:
            raise ManifestError(
                f"Haxelib {name!r} is declared with conflicting versions "
                f"{dependencies[name]['version']!r} and {version!r}."
            )
        dependencies[name] = record

    return root, sorted(dependencies.values(), key=lambda item: item["name"].lower()), symbols


def list_installed_haxelibs() -> dict[str, set[str]]:
    executable = shutil.which("haxelib")
    if not executable:
        return {}
    result = subprocess.run([executable, "list"], text=True, capture_output=True, check=False)
    if result.returncode:
        raise ManifestError("'haxelib list' failed. Run 'haxelib setup' first and retry.\n" + result.stderr.strip())
    installed: dict[str, set[str]] = {}
    for line in result.stdout.splitlines():
        if ":" not in line:
            continue
        name, version_text = line.split(":", 1)
        versions = set(re.findall(r"\[([^\]]+)\]", version_text))
        installed[name.strip()] = versions
    return installed


def run_install(dependencies: list[dict[str, str]]) -> int:
    executable = shutil.which("haxelib")
    if not executable or not shutil.which("haxe"):
        print("ERROR: Haxe and haxelib were not found on PATH. Install Haxe and configure haxelib before using --install.", file=sys.stderr)
        return 2
    installed = list_installed_haxelibs()
    failed = False
    for dependency in dependencies:
        name = dependency["name"]
        version = dependency["version"]
        if name in installed and (not version or version in installed[name]):
            print(f"Already installed: {name}" + (f" {version}" if version else ""))
            continue
        command = [executable, "install", name]
        if version:
            command.append(version)
        print("Installing:", " ".join(command[1:]), flush=True)
        result = subprocess.run(command, check=False)
        if result.returncode:
            print(f"ERROR: haxelib install failed for {name} (exit code {result.returncode}).", file=sys.stderr)
            failed = True
        else:
            print(f"Installed: {name}" + (f" {version}" if version else ""))
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, help="Psych Engine project directory or Project.xml path")
    parser.add_argument("--target", choices=("windows", "linux", "mac", "android", "ios", "html5"), default=host_target())
    parser.add_argument("--build", choices=("debug", "release"), default="debug")
    parser.add_argument("--official-build", action="store_true", help="enable Project.xml's officialBuild sections")
    parser.add_argument("--32bits", dest="bits32", action="store_true", help="enable 32-bit Project.xml conditions")
    parser.add_argument("--define", action="append", default=[], help="add a Lime feature define (repeatable)")
    parser.add_argument("--install", action="store_true", help="install missing active Haxelibs using haxelib; default is read-only")
    args = parser.parse_args()

    path = args.project.expanduser().resolve()
    manifest = path if path.is_file() else path / "Project.xml"
    if not manifest.exists() and not path.is_file():
        lowercase = path / "project.xml"
        if lowercase.exists():
            manifest = lowercase
    try:
        root, dependencies, symbols = collect_dependencies(
            manifest, args.target, args.build, args.official_build, args.bits32, tuple(args.define)
        )
    except (ManifestError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    app = root.find("app")
    title = app.get("title", "(not declared)") if app is not None else "(not declared)"
    main_class = app.get("main", "(not declared)") if app is not None else "(not declared)"
    print(f"Project: {title}")
    print(f"Manifest: {manifest}")
    print(f"Haxe entry class: {main_class}")
    print(f"Target profile: {args.target}, {args.build}" + (", officialBuild" if args.official_build else ""))
    print("Active feature symbols:", ", ".join(sorted(name for name, active in symbols.items() if active)) or "(none)")
    print("\nActive Haxelib declarations:")
    if not dependencies:
        print("  (none)")
    for dependency in dependencies:
        version = f" {dependency['version']}" if dependency["version"] else " (latest declared)"
        print(f"  {dependency['name']}{version}")

    if args.install:
        return run_install(dependencies)
    print("\nRead-only mode. Add --install to run haxelib install for missing declarations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
