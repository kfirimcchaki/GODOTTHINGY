# GODOTTHINGY — Godot 4.7.2 Psych Engine bridge

This repository pins the official **Godot 4.7.2-stable** source as a Git submodule (`upstream/godot`) at `ed1daf0bf001b61586d9930840f2f1394092c079`. Godot's upstream source is not vendored or rewritten in this repository. The integration is kept as a small, separately versioned native-module overlay and a focused Project Manager patch.

> **Scope note:** This is an initial, working integration foundation—not a finished port of Psych Engine, Codename Engine, or the official FNF engine. Psych Engine is a Haxe/Lime/HaxeFlixel application. Godot does not execute Haxe or Flixel code natively, and a complete replacement runtime/editor suite is a multi-year engine project. This repository does not claim zero-compile Psych gameplay, complete Lua/HScript APIs, or full chart/character/stage editors.

## What is implemented

- **Project Manager import for Lime `Project.xml`:** the pinned Godot patch recognizes `Project.xml` / `project.xml`. Importing a Psych repository with no `project.godot` adds a small wrapper `project.godot` with `psych_engine/enabled` and `psych_engine/manifest` settings. It does not rewrite `Project.xml`, Haxe source, or asset files. Projects that already have a `project.godot` are left alone.
- **Native `PsychProjectDescriptor` class:** parses app metadata, Haxelib declarations, asset rules, classpaths, defines, compiler flags, and Lime settings. It preserves conditions instead of guessing which target-specific rules are active and reports missing/unsafe paths.
- **Psych editor workspace:** built into the Godot editor for projects imported through the Psych manifest path. It shows parsed metadata, dependency declarations, source/asset rules, and validation diagnostics.
- **Native `PsychConductor` node:** double-precision song clock, piecewise BPM map, seek/audio synchronization, playback rate, and `step_hit`, `beat_hit`, `measure_hit`, and `section_hit` signals.
- **Read-only Haxelib inspection tool:** `tools/psych_haxelib.py` resolves the simple Lime conditions used by `Project.xml`, prints dependencies for a target profile, and installs them only when explicitly invoked with `--install`.
- **Windows editor build script:** `build.bat` finds Python, installs SCons for the current user if needed, initializes the MSVC x64 environment with `vswhere.exe`, stages the compatibility patch, and builds the editor.

## Get the source

Clone with submodules so the pinned Godot source is available:

```sh
git clone --recurse-submodules https://github.com/kfirimcchaki/GODOTTHINGY.git
cd GODOTTHINGY
```

If the repository was cloned without submodules:

```sh
git submodule update --init --depth 1 -- upstream/godot
```

The `upstream/godot` submodule remains pinned to the official 4.7.2-stable commit. Do not commit a changed submodule pointer when building locally; the integration patch and module source live in this repository.

## Build the integrated editor

### Linux

Install the Godot build prerequisites and SCons, then run:

```sh
python3 -m pip install --user scons
JOBS=2 ./build.sh
```

`build.sh` applies the version-pinned Project Manager patch and passes the native module through Godot's `custom_modules` SCons option. The default job count is conservative; set `JOBS` to a higher number if the machine has enough memory.

### Windows

Install Visual Studio 2022 with the **Desktop development with C++** workload and Python 3, then run:

```bat
build.bat
```

The target is `upstream\godot\bin\godot.windows.editor.x86_64.exe`.

### Manual SCons invocation

From the repository root, first initialize the submodule and apply the patch:

```sh
python3 tools/integrate.py --engine upstream/godot
```

Then from `upstream/godot`:

```sh
scons platform=windows target=editor dev_build=no optimize=speed -j%NUMBER_OF_PROCESSORS% custom_modules="%CD%\..\..\integration\modules\psych_engine"
```

On Linux, use `platform=linuxbsd` and a quoted absolute path for `custom_modules`.

## Open a Psych Engine source repository

1. Build and run this fork's Godot editor.
2. In the Project Manager choose **Import Existing Project**.
3. Select the Psych Engine repository directory, or its `Project.xml` file.
4. The importer creates only the wrapper `project.godot`; Godot then opens and scans the project normally.
5. Select the **Psych** workspace to inspect the Lime manifest.

For dependency inspection on a target profile:

```sh
python3 tools/psych_haxelib.py /path/to/FNF-PsychEngine --target windows --build debug
```

To install the active manifest dependencies using a configured Haxe/Haxelib toolchain, explicitly add `--install`:

```sh
python3 tools/psych_haxelib.py /path/to/FNF-PsychEngine --target windows --build debug --install
```

The dependency command is opt-in and runs `haxelib` outside Godot. It does not download arbitrary GitHub repositories, modify the Haxe sources, or claim to recreate HaxeFlixel inside Godot.

## Important limitations

The current integration does **not** implement a Haxe VM/compiler, Flixel/OpenFL compatibility layer, Psych Lua or Codename HScript runtime, chart playback/judgement, Funkin chart conversion, FNF visual chart/character/stage/week/dialogue editors, sprite-sheet packing, or the requested visual graph compiler. It also does not bundle Psych Engine or its large copyrighted asset tree. Those pieces need separate designs, licensed source/dependency review, and substantial implementation and testing; they cannot be delivered honestly by treating a Haxe project manifest as an executable Godot project.

When Godot opens an imported Psych repository, it can index/import recognized assets. Large projects may take time and consume disk space. The wrapper is the only intentional file added to the Psych repository; generated Godot cache/import data is separate from its original Haxe code.

## Tests

The standalone tools can be checked with:

```sh
python3 -m unittest discover -s tests -v
```

After building the native editor, run the C++ module runtime tests through Godot:

```sh
GODOT_BIN=upstream/godot/bin/godot.linuxbsd.editor.x86_64 tests/run_native_tests.sh
```
