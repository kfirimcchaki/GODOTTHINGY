# `psych_engine` native module overlay

This module is built with Godot's `custom_modules` SCons option, so it does not need to be copied into or committed inside the pinned upstream submodule.

## Runtime classes

- `PsychProjectDescriptor` reads Lime `Project.xml` as metadata only. It preserves `if`/`unless` text and does not execute conditions or install dependencies.
- `PsychConductor` converts between milliseconds and steps across a sorted tempo map, emits timing signals, and can be driven by frame time or synchronized to an external audio position.

## Editor integration

When `psych_engine/enabled=true` is present in the wrapper `project.godot`, `PsychProjectEditorPlugin` adds the **Psych** main-screen workspace. It presents manifest and path diagnostics and clearly identifies that Haxe/Lime must still build the original Psych game.

## Deliberately not provided

No Haxe interpreter/compiler, Flixel API emulation, Psych Lua/HScript bridge, full FNF player, or native FNF content editors are implemented in this first slice. Those are not implied by being able to parse `Project.xml`.
