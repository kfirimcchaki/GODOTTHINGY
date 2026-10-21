# Integration roadmap and engineering boundaries

The requirements describe several independent products: a Godot fork, a Haxe/Lime project importer, a Psych runtime, three families of content editors, Lua/HScript/GDScript tooling, and compatibility with two other FNF engines. They cannot be safely collapsed into a single import step. Each phase should have a runnable acceptance test before the next is represented as supported.

## Phase 0 — Manifest bridge (current)

- Pin upstream Godot 4.7.2-stable and build a separate native module.
- Import Lime `Project.xml` from the normal Project Manager without touching Haxe source files.
- Surface app metadata, Haxelibs, assets, classpaths, defines, and diagnostics in the Psych workspace.
- Provide a tested Haxelib condition resolver and a double-precision tempo-map/conductor core.

**Acceptance:** the Project Manager creates a wrapper only when no `project.godot` exists; the Psych workspace parses the official Psych manifest; invalid paths and XML fail visibly; existing ordinary Godot projects retain normal behavior.

## Phase 1 — Haxe toolchain interoperability

- Define supported Haxe, Lime, OpenFL, HaxeFlixel, Psych Engine, and target-platform version ranges.
- Run toolchain commands as explicit user actions, with dependency lock/report files, cancellation, and captured logs.
- Verify that original Haxe files remain unchanged after import, setup, build, and refresh.
- Keep Haxe compilation an external, well-contained operation until a real Haxe runtime/interpreter is designed.

**Acceptance:** reproducible clean build of an unmodified Psych checkout on each claimed target; no silent global Haxelib changes; actionable diagnostics for missing libraries and native codecs.

## Phase 2 — Read-only FNF data adapters

- Specify separate, versioned adapters for Psych chart JSON, official Funkin chart/metadata formats, and Codename charts.
- Preserve unknown fields and event payloads on round-trip; reject malformed or unsupported versions with file/line diagnostics.
- Test tempo maps, sections, lane mapping, sustain lengths, note types, events, and time-change edge cases against real, licensed fixtures.

**Acceptance:** lossless parse/serialize fixtures and explicit conversion-loss reports. Do not advertise dual-format support before these pass.

## Phase 3 — Godot-native rhythm runtime

- Add chart resources and a player as ordinary Godot nodes/resources, using the conductor and data adapters.
- Define judgement windows, input mapping, scoring, audio latency calibration, bot play, and rendering as documented profiles rather than implicit approximations.
- Add deterministic tests for tempo changes, seeks, large frame deltas, playback rates, and judgement boundaries.

**Acceptance:** stable replay tests and parity fixtures against the specific Psych version being targeted. This is a new Godot runtime, not a replacement Haxe runtime.

## Phase 4 — Content editors

Implement chart, character/offset, stage, week/mod, dialogue, and atlas editors as independent workflows. Each needs undo/redo, round-trip tests, and a defined mapping between original Psych assets and any Godot-native representations. Avoid writing back to Haxe source formats unless the user explicitly exports.

## Phase 5 — Scripting and visual graph

- Decide whether Lua runs in a sandboxed VM or as a host process; define API parity and mod security.
- HScript/Haxe execution requires a separately specified runtime or compiler integration. GDScript remains Godot's native script target; matching syntax does not make Haxe APIs compatible.
- Design the node graph around a typed event/API schema and generate code only for targets with executable implementations.

## Phase 6 — Cross-engine compatibility and starter content

- Add Funkin Crew and Codename format adapters only after their licenses, schemas, and version targets are documented.
- Keep bundled samples minimal and verify asset redistribution rights before adding any copyrighted base-game assets or music.
- Generate starter projects from licensed or user-provided content; never silently copy commercial assets from a game repository.

## Non-negotiable boundaries

- Import metadata and Godot wrapper files are not a native Psych runtime.
- A Lime `Project.xml` lists build inputs; it does not provide or install every native codec/toolchain component on its own.
- The original Psych/Codename/Funkin source trees are not rewritten by the bridge.
- Every new engine/editor capability needs build coverage, serialization tests, and a clear statement of the exact upstream format/version supported.
