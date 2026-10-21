from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.psych_haxelib import ConditionParser, ManifestError, collect_dependencies


SAMPLE_PROJECT_XML = """<?xml version="1.0"?>
<project>
    <app title="Test Psych Project" main="Main" />
    <define name="LUA_ALLOWED" if="desktop" />
    <haxelib name="flixel" version="5.6.1" />
    <haxelib name="linc_luajit" if="LUA_ALLOWED" />
    <haxelib name="debug-helper" if="debug" />
    <section if="officialBuild">
        <define name="VIDEOS_ALLOWED" if="windows || linux || mac" unless="32bits" />
        <haxelib name="hxvlc" if="VIDEOS_ALLOWED" version="2.0.1" />
    </section>
    <haxelib name="unknown-optional" if="UNDECLARED_FEATURE" />
</project>
"""


class ConditionParserTests(unittest.TestCase):
    def test_supports_lime_implicit_and_or_not_and_parentheses(self) -> None:
        symbols = {"desktop": True, "release": False, "windows": True, "linux": False}
        self.assertTrue(ConditionParser("desktop windows", symbols).evaluate())
        self.assertFalse(ConditionParser("desktop release", symbols).evaluate())
        self.assertTrue(ConditionParser("windows || linux", symbols).evaluate())
        self.assertTrue(ConditionParser("(windows || linux) && desktop", symbols).evaluate())
        self.assertTrue(ConditionParser("!release", symbols).evaluate())
        self.assertFalse(ConditionParser("UNKNOWN", symbols).evaluate())

    def test_rejects_unsupported_syntax_instead_of_evaluating_code(self) -> None:
        with self.assertRaises(ManifestError):
            ConditionParser("desktop; __import__('os')", {"desktop": True}).evaluate()


class HaxelibManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_dir = Path(self.temp_dir.name)
        self.manifest = self.project_dir / "Project.xml"
        self.manifest.write_text(SAMPLE_PROJECT_XML, encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_desktop_debug_profile_resolves_required_libraries(self) -> None:
        _, dependencies, symbols = collect_dependencies(self.manifest, "windows", "debug", False, False)
        self.assertEqual(
            [(item["name"], item["version"]) for item in dependencies],
            [("debug-helper", ""), ("flixel", "5.6.1"), ("linc_luajit", "")],
        )
        self.assertTrue(symbols["LUA_ALLOWED"])
        self.assertNotIn("VIDEOS_ALLOWED", symbols)

    def test_official_desktop_profile_activates_optional_video_dependency(self) -> None:
        _, dependencies, symbols = collect_dependencies(self.manifest, "linux", "release", True, False)
        self.assertEqual(
            [(item["name"], item["version"]) for item in dependencies],
            [("flixel", "5.6.1"), ("hxvlc", "2.0.1"), ("linc_luajit", "")],
        )
        self.assertTrue(symbols["VIDEOS_ALLOWED"])

    def test_32_bit_condition_disables_video_dependency(self) -> None:
        _, dependencies, symbols = collect_dependencies(self.manifest, "windows", "release", True, True)
        self.assertNotIn("hxvlc", {item["name"] for item in dependencies})
        self.assertFalse(symbols.get("VIDEOS_ALLOWED", False))

    def test_custom_define_can_enable_a_conditional_library(self) -> None:
        _, dependencies, _ = collect_dependencies(
            self.manifest, "linux", "release", False, False, ("UNDECLARED_FEATURE",)
        )
        self.assertIn("unknown-optional", {item["name"] for item in dependencies})

    def test_invalid_xml_is_reported(self) -> None:
        self.manifest.write_text("<project><haxelib>", encoding="utf-8")
        with self.assertRaises(ManifestError):
            collect_dependencies(self.manifest, "linux", "debug", False, False)

    def test_non_project_root_is_rejected(self) -> None:
        self.manifest.write_text("<not-a-project />", encoding="utf-8")
        with self.assertRaises(ManifestError):
            collect_dependencies(self.manifest, "linux", "debug", False, False)


if __name__ == "__main__":
    unittest.main()
