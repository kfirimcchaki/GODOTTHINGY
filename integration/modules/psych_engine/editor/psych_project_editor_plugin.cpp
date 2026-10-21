/**************************************************************************/
/*  psych_project_editor_plugin.cpp                                       */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#include "psych_project_editor_plugin.h"

#include "../psych_project_descriptor.h"

#include "core/config/project_settings.h"
#include "core/io/file_access.h"
#include "core/object/callable_mp.h"
#include "core/object/class_db.h"
#include "core/os/os.h"
#include "editor/editor_main_screen.h"
#include "editor/editor_node.h"
#include "scene/gui/button.h"
#include "scene/gui/label.h"
#include "scene/gui/rich_text_label.h"
#include "scene/gui/separator.h"

String PsychProjectEditorPlugin::get_plugin_name() const {
	return "Psych";
}

bool PsychProjectEditorPlugin::has_main_screen() const {
	ProjectSettings *settings = ProjectSettings::get_singleton();
	return settings && (bool)settings->get_setting("psych_engine/enabled", false);
}

void PsychProjectEditorPlugin::make_visible(bool p_visible) {
	if (workspace) {
		workspace->set_visible(p_visible);
	}
}

void PsychProjectEditorPlugin::_append_records(String &r_text, const String &p_heading, const Array &p_records, const String &p_name_key) {
	r_text += "\n" + p_heading + " (" + itos(p_records.size()) + ")\n";
	for (int i = 0; i < p_records.size(); i++) {
		if (p_records[i].get_type() != Variant::DICTIONARY) {
			continue;
		}
		const Dictionary record = p_records[i];
		String name = String(record.get(p_name_key, "(unnamed)"));
		r_text += "  • " + name;
		const String version = String(record.get("version", ""));
		if (!version.is_empty()) {
			r_text += " " + version;
		}
		const String path = String(record.get("path", ""));
		if (!path.is_empty()) {
			r_text += " — " + path;
		}
		const String condition = String(record.get("condition", ""));
		if (!condition.is_empty()) {
			r_text += " [" + condition + "]";
		}
		r_text += "\n";
	}
}

void PsychProjectEditorPlugin::_refresh_manifest() {
	if (!descriptor.is_valid() || !details_view || !title_label || !status_label) {
		return;
	}

	ProjectSettings *settings = ProjectSettings::get_singleton();
	if (settings) {
		const String configured_manifest = String(settings->get_setting("psych_engine/manifest", "Project.xml"));
		const String project_root = settings->get_resource_path();
		manifest_path = project_root.path_join(configured_manifest);
		if (!FileAccess::exists(manifest_path) && configured_manifest == "Project.xml") {
			const String lowercase_manifest = project_root.path_join("project.xml");
			if (FileAccess::exists(lowercase_manifest)) {
				manifest_path = lowercase_manifest;
			}
		}
	}

	const Error parse_error = descriptor->parse_file(manifest_path);
	if (parse_error != OK || !descriptor->is_valid()) {
		title_label->set_text("Psych Engine Project");
		status_label->set_text("Project.xml could not be loaded: " + descriptor->get_error_message());
		details_view->set_text("This workspace was enabled for a Psych Engine project, but its manifest is missing or invalid.\n\nExpected: " + manifest_path);
		return;
	}

	const String title = descriptor->get_application_title().is_empty() ? "Psych Engine Project" : descriptor->get_application_title();
	title_label->set_text(title);
	status_label->set_text("Manifest parsed. Haxe/Lime dependencies and asset declarations are shown below.");

	String report;
	report += "Project manifest: " + descriptor->get_project_file_path() + "\n";
	report += "Haxe entry class: " + (descriptor->get_application_main_class().is_empty() ? "(not declared)" : descriptor->get_application_main_class()) + "\n";
	report += "Application version: " + (descriptor->get_application_version().is_empty() ? "(not declared)" : descriptor->get_application_version()) + "\n";
	report += "Package: " + (descriptor->get_application_package().is_empty() ? "(not declared)" : descriptor->get_application_package()) + "\n";
	report += "\nImportant: this bridge reads Lime/Haxe metadata without rewriting the original Haxe files. Godot does not execute Haxe/Flixel code natively; building the original game still requires its Haxe/Lime toolchain.\n";

	_append_records(report, "Haxelib declarations", descriptor->get_haxelib_dependencies(), "name");
	_append_records(report, "Haxe classpaths", descriptor->get_class_paths(), "name");
	_append_records(report, "Asset rules", descriptor->get_asset_rules(), "path");
	_append_records(report, "Haxe defines", descriptor->get_defines(), "name");
	_append_records(report, "Haxe compiler flags", descriptor->get_haxedefs(), "name");

	const Array project_diagnostics = descriptor->get_diagnostics();
	if (!project_diagnostics.is_empty()) {
		report += "\nValidation diagnostics (" + itos(project_diagnostics.size()) + ")\n";
		for (int i = 0; i < project_diagnostics.size(); i++) {
			if (project_diagnostics[i].get_type() != Variant::DICTIONARY) {
				continue;
			}
			const Dictionary diagnostic = project_diagnostics[i];
			report += "  " + String(diagnostic.get("severity", "info")).to_upper() + ": ";
			report += String(diagnostic.get("message", ""));
			const String path = String(diagnostic.get("path", ""));
			if (!path.is_empty()) {
				report += " (" + path + ")";
			}
			report += "\n";
		}
	}
	details_view->set_text(report);
}

void PsychProjectEditorPlugin::_open_project_folder() {
	ProjectSettings *settings = ProjectSettings::get_singleton();
	if (!settings) {
		return;
	}
	OS::get_singleton()->shell_open(settings->get_resource_path());
}

void PsychProjectEditorPlugin::_bind_methods() {
	ClassDB::bind_method(D_METHOD("_refresh_manifest"), &PsychProjectEditorPlugin::_refresh_manifest);
	ClassDB::bind_method(D_METHOD("_open_project_folder"), &PsychProjectEditorPlugin::_open_project_folder);
}

PsychProjectEditorPlugin::PsychProjectEditorPlugin() {
	if (!has_main_screen()) {
		return;
	}

	descriptor.instantiate();

	workspace = memnew(VBoxContainer);
	workspace->set_name("PsychWorkspace");
	workspace->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	workspace->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	workspace->set_anchors_and_offsets_preset(Control::PRESET_FULL_RECT);

	title_label = memnew(Label);
	title_label->set_text("Psych Engine Project");
	title_label->add_theme_font_size_override("font_size", 24);
	workspace->add_child(title_label);

	status_label = memnew(Label);
	status_label->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	workspace->add_child(status_label);

	HBoxContainer *actions = memnew(HBoxContainer);
	workspace->add_child(actions);

	Button *refresh_button = memnew(Button);
	refresh_button->set_text("Refresh Project.xml");
	refresh_button->connect(SceneStringName(pressed), callable_mp(this, &PsychProjectEditorPlugin::_refresh_manifest));
	actions->add_child(refresh_button);

	Button *open_folder_button = memnew(Button);
	open_folder_button->set_text("Open Project Folder");
	open_folder_button->connect(SceneStringName(pressed), callable_mp(this, &PsychProjectEditorPlugin::_open_project_folder));
	actions->add_child(open_folder_button);

	HSeparator *separator = memnew(HSeparator);
	workspace->add_child(separator);

	details_view = memnew(RichTextLabel);
	details_view->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	details_view->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	details_view->set_fit_content(false);
	details_view->set_selection_enabled(true);
	workspace->add_child(details_view);

	EditorMainScreen *main_screen = EditorNode::get_singleton()->get_editor_main_screen();
	if (main_screen) {
		main_screen->get_control()->add_child(workspace);
		workspace->hide();
		_refresh_manifest();
	}
}
