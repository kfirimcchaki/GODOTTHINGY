/**************************************************************************/
/*  psych_project_editor_plugin.h                                         */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#pragma once

#include "../psych_project_descriptor.h"

#include "core/variant/array.h"
#include "editor/plugins/editor_plugin.h"
#include "scene/gui/box_container.h"

class Label;
class RichTextLabel;

class PsychProjectEditorPlugin : public EditorPlugin {
	GDCLASS(PsychProjectEditorPlugin, EditorPlugin);

	VBoxContainer *workspace = nullptr;
	Label *title_label = nullptr;
	Label *status_label = nullptr;
	RichTextLabel *details_view = nullptr;
	Ref<PsychProjectDescriptor> descriptor;
	String manifest_path;

	void _refresh_manifest();
	void _open_project_folder();
	void _append_records(String &r_text, const String &p_heading, const Array &p_records, const String &p_name_key);

protected:
	static void _bind_methods();

public:
	String get_plugin_name() const override;
	bool has_main_screen() const override;
	void make_visible(bool p_visible) override;

	PsychProjectEditorPlugin();
};
