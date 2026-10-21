/**************************************************************************/
/*  psych_project_descriptor.cpp                                          */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#include "psych_project_descriptor.h"

#include "core/config/project_settings.h"
#include "core/io/dir_access.h"
#include "core/io/file_access.h"
#include "core/io/xml_parser.h"
#include "core/object/class_db.h"

namespace {

static constexpr uint64_t MAX_PROJECT_XML_SIZE = 8 * 1024 * 1024;

struct ElementFrame {
	String name;
	String section_condition;
};

static String _resolve_manifest_path(const String &p_path) {
	String path = p_path.strip_edges();
	if (path.begins_with("res://") || path.begins_with("user://")) {
		if (ProjectSettings::get_singleton()) {
			return ProjectSettings::get_singleton()->globalize_path(path).simplify_path();
		}
		return "";
	}
	if (path.is_relative_path()) {
		if (ProjectSettings::get_singleton()) {
			return ProjectSettings::get_singleton()->globalize_path("res://" + path).simplify_path();
		}
		Ref<DirAccess> directory = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
		if (directory.is_valid()) {
			return directory->get_current_dir().path_join(path).simplify_path();
		}
		return path.simplify_path();
	}
	return path.simplify_path();
}

static String _join_conditions(const Vector<String> &p_conditions) {
	String result;
	for (int i = 0; i < p_conditions.size(); i++) {
		if (p_conditions[i].is_empty()) {
			continue;
		}
		if (!result.is_empty()) {
			result += " && ";
		}
		result += "(" + p_conditions[i] + ")";
	}
	return result;
}

static Dictionary _attributes_to_dictionary(const Ref<XMLParser> &p_parser) {
	Dictionary attributes;
	for (int i = 0; i < p_parser->get_attribute_count(); i++) {
		attributes[p_parser->get_attribute_name(i)] = p_parser->get_attribute_value(i);
	}
	return attributes;
}

} // namespace

void PsychProjectDescriptor::_clear() {
	project_file_path = "";
	project_root_path = "";
	application_title = "";
	application_file = "";
	application_package = "";
	application_main_class = "";
	application_version = "";
	application_company = "";
	error_message = "";
	valid = false;
	haxelib_dependencies.clear();
	asset_rules.clear();
	class_paths.clear();
	defines.clear();
	haxedefs.clear();
	settings.clear();
	diagnostics.clear();
}

void PsychProjectDescriptor::_add_diagnostic(const String &p_severity, const String &p_message, const String &p_path) {
	Dictionary diagnostic;
	diagnostic["severity"] = p_severity;
	diagnostic["message"] = p_message;
	if (!p_path.is_empty()) {
		diagnostic["path"] = p_path;
	}
	diagnostics.push_back(diagnostic);
}

String PsychProjectDescriptor::_build_effective_condition(const Vector<String> &p_section_conditions, const String &p_if, const String &p_unless) const {
	Vector<String> conditions = p_section_conditions;
	if (!p_if.strip_edges().is_empty()) {
		conditions.push_back(p_if.strip_edges());
	}
	if (!p_unless.strip_edges().is_empty()) {
		conditions.push_back("!(" + p_unless.strip_edges() + ")");
	}
	return _join_conditions(conditions);
}

void PsychProjectDescriptor::_validate_paths() {
	for (int i = 0; i < class_paths.size(); i++) {
		Dictionary entry = class_paths[i];
		String path = String(entry.get("name", "")).strip_edges();
		if (path.is_empty()) {
			_add_diagnostic("error", "A <classpath> entry has no name attribute.");
			continue;
		}
		if (path.is_absolute_path()) {
			_add_diagnostic("warning", "Classpath is absolute; this project is not portable.", path);
			continue;
		}
		String normalized = path.simplify_path();
		if (normalized == ".." || normalized.begins_with("../")) {
			_add_diagnostic("warning", "Classpath resolves outside the Psych project directory.", path);
			continue;
		}
		if (!DirAccess::dir_exists_absolute(project_root_path.path_join(normalized))) {
			_add_diagnostic("warning", "Declared Haxe classpath directory was not found.", path);
		}
	}

	for (int i = 0; i < asset_rules.size(); i++) {
		Dictionary entry = asset_rules[i];
		String path = String(entry.get("path", "")).strip_edges();
		if (path.is_empty()) {
			_add_diagnostic("error", "An <assets> entry has no path attribute.");
			continue;
		}
		if (path.is_absolute_path()) {
			_add_diagnostic("warning", "Asset root is absolute; this project is not portable.", path);
			continue;
		}
		String normalized = path.simplify_path();
		if (normalized == ".." || normalized.begins_with("../")) {
			_add_diagnostic("warning", "Asset root resolves outside the Psych project directory.", path);
			continue;
		}
		const String absolute_asset_path = project_root_path.path_join(normalized);
		if (!DirAccess::dir_exists_absolute(absolute_asset_path) && !FileAccess::exists(absolute_asset_path)) {
			_add_diagnostic("warning", "Declared asset path was not found. It may be conditional or intentionally omitted.", path);
		}
	}

	for (int i = 0; i < haxelib_dependencies.size(); i++) {
		Dictionary dependency = haxelib_dependencies[i];
		if (String(dependency.get("name", "")).strip_edges().is_empty()) {
			_add_diagnostic("error", "A <haxelib> entry has no name attribute.");
		}
	}
}

Error PsychProjectDescriptor::parse_file(const String &p_file_path) {
	_clear();

	const String absolute_path = _resolve_manifest_path(p_file_path);
	if (absolute_path.is_empty()) {
		error_message = "The manifest path could not be resolved. Use an absolute path or res:// path inside a Godot project.";
		_add_diagnostic("error", error_message, p_file_path);
		return ERR_INVALID_PARAMETER;
	}

	if (!FileAccess::exists(absolute_path)) {
		error_message = "Project.xml does not exist at the specified path.";
		_add_diagnostic("error", error_message, absolute_path);
		return ERR_FILE_NOT_FOUND;
	}

	Ref<FileAccess> manifest = FileAccess::open(absolute_path, FileAccess::READ);
	if (manifest.is_null()) {
		error_message = "Project.xml could not be opened for reading.";
		_add_diagnostic("error", error_message, absolute_path);
		return ERR_CANT_OPEN;
	}
	if (manifest->get_length() > MAX_PROJECT_XML_SIZE) {
		error_message = "Project.xml exceeds the 8 MiB safety limit.";
		_add_diagnostic("error", error_message, absolute_path);
		return ERR_FILE_CORRUPT;
	}
	manifest->close();

	Ref<XMLParser> parser;
	parser.instantiate();
	Error err = parser->open(absolute_path);
	if (err != OK) {
		error_message = "Project.xml could not be parsed.";
		_add_diagnostic("error", error_message, absolute_path);
		return err;
	}

	project_file_path = absolute_path;
	project_root_path = absolute_path.get_base_dir();

	bool root_seen = false;
	bool root_closed = false;
	Vector<ElementFrame> stack;

	while ((err = parser->read()) == OK) {
		const XMLParser::NodeType node_type = parser->get_node_type();
		if (node_type == XMLParser::NODE_ELEMENT) {
			const String node_name = parser->get_node_name();
			if (!root_seen) {
				if (node_name != "project") {
					error_message = "The XML root element must be <project>.";
					_add_diagnostic("error", error_message, absolute_path);
					return ERR_PARSE_ERROR;
				}
				root_seen = true;
			}

			Vector<String> section_conditions;
			for (int i = 0; i < stack.size(); i++) {
				if (stack[i].name == "section" && !stack[i].section_condition.is_empty()) {
					section_conditions.push_back(stack[i].section_condition);
				}
			}

			const String local_if = parser->get_named_attribute_value_safe("if");
			const String local_unless = parser->get_named_attribute_value_safe("unless");
			const String effective_condition = _build_effective_condition(section_conditions, local_if, local_unless);

			if (node_name == "app" && application_title.is_empty()) {
				application_title = parser->get_named_attribute_value_safe("title");
				application_file = parser->get_named_attribute_value_safe("file");
				application_package = parser->get_named_attribute_value_safe("packageName");
				if (application_package.is_empty()) {
					application_package = parser->get_named_attribute_value_safe("package");
				}
				application_main_class = parser->get_named_attribute_value_safe("main");
				application_version = parser->get_named_attribute_value_safe("version");
				application_company = parser->get_named_attribute_value_safe("company");
			}

			if (node_name == "haxelib") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				haxelib_dependencies.push_back(entry);
			}
			if (node_name == "assets") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				asset_rules.push_back(entry);
			}
			if (node_name == "classpath") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				class_paths.push_back(entry);
			}
			if (node_name == "define") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				defines.push_back(entry);
			}
			if (node_name == "haxedef") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				haxedefs.push_back(entry);
			}
			if (node_name == "set") {
				Dictionary entry = _attributes_to_dictionary(parser);
				entry["condition"] = effective_condition;
				settings.push_back(entry);
			}

			if (node_name == "section" && !parser->is_empty()) {
				ElementFrame frame;
				frame.name = node_name;
				frame.section_condition = _build_effective_condition(section_conditions, local_if, local_unless);
				stack.push_back(frame);
			} else if (!parser->is_empty()) {
				ElementFrame frame;
				frame.name = node_name;
				stack.push_back(frame);
			}
		} else if (node_type == XMLParser::NODE_ELEMENT_END) {
			const String node_name = parser->get_node_name();
			if (node_name == "project") {
				root_closed = true;
			}
			if (!stack.is_empty() && stack[stack.size() - 1].name == node_name) {
				stack.resize(stack.size() - 1);
			}
		}
	}

	if (err != ERR_FILE_EOF || !root_seen || !root_closed) {
		error_message = "Project.xml ended unexpectedly or is not a valid Lime project manifest.";
		_add_diagnostic("error", error_message, absolute_path);
		return ERR_PARSE_ERROR;
	}

	if (application_title.is_empty()) {
		_add_diagnostic("warning", "No <app title=...> element was found; the Godot project name will use the folder name.");
	}
	if (application_main_class.is_empty()) {
		_add_diagnostic("warning", "No Haxe entry class was declared in <app main=...>.");
	}

	_validate_paths();
	bool has_errors = false;
	for (int i = 0; i < diagnostics.size(); i++) {
		if (diagnostics[i].get_type() != Variant::DICTIONARY) {
			continue;
		}
		const Dictionary diagnostic = diagnostics[i];
		if (String(diagnostic.get("severity", "")) == "error") {
			has_errors = true;
			if (error_message.is_empty()) {
				error_message = String(diagnostic.get("message", "Project.xml contains an invalid declaration."));
			}
		}
	}
	if (has_errors) {
		return ERR_INVALID_DATA;
	}
	valid = true;
	return OK;
}

bool PsychProjectDescriptor::is_valid() const {
	return valid;
}

String PsychProjectDescriptor::get_error_message() const {
	return error_message;
}

String PsychProjectDescriptor::get_project_file_path() const {
	return project_file_path;
}

String PsychProjectDescriptor::get_project_root_path() const {
	return project_root_path;
}

String PsychProjectDescriptor::get_application_title() const {
	return application_title;
}

String PsychProjectDescriptor::get_application_file() const {
	return application_file;
}

String PsychProjectDescriptor::get_application_package() const {
	return application_package;
}

String PsychProjectDescriptor::get_application_main_class() const {
	return application_main_class;
}

String PsychProjectDescriptor::get_application_version() const {
	return application_version;
}

String PsychProjectDescriptor::get_application_company() const {
	return application_company;
}

Array PsychProjectDescriptor::get_haxelib_dependencies() const {
	return haxelib_dependencies.duplicate(true);
}

Array PsychProjectDescriptor::get_asset_rules() const {
	return asset_rules.duplicate(true);
}

Array PsychProjectDescriptor::get_class_paths() const {
	return class_paths.duplicate(true);
}

Array PsychProjectDescriptor::get_defines() const {
	return defines.duplicate(true);
}

Array PsychProjectDescriptor::get_haxedefs() const {
	return haxedefs.duplicate(true);
}

Array PsychProjectDescriptor::get_settings() const {
	return settings.duplicate(true);
}

Array PsychProjectDescriptor::get_diagnostics() const {
	return diagnostics.duplicate(true);
}

Dictionary PsychProjectDescriptor::get_summary() const {
	Dictionary summary;
	summary["valid"] = valid;
	summary["project_file_path"] = project_file_path;
	summary["project_root_path"] = project_root_path;
	summary["title"] = application_title;
	summary["file"] = application_file;
	summary["package"] = application_package;
	summary["main_class"] = application_main_class;
	summary["version"] = application_version;
	summary["company"] = application_company;
	summary["haxelib_count"] = haxelib_dependencies.size();
	summary["asset_rule_count"] = asset_rules.size();
	summary["classpath_count"] = class_paths.size();
	summary["error_message"] = error_message;
	return summary;
}

void PsychProjectDescriptor::_bind_methods() {
	ClassDB::bind_method(D_METHOD("parse_file", "file_path"), &PsychProjectDescriptor::parse_file);
	ClassDB::bind_method(D_METHOD("is_valid"), &PsychProjectDescriptor::is_valid);
	ClassDB::bind_method(D_METHOD("get_error_message"), &PsychProjectDescriptor::get_error_message);
	ClassDB::bind_method(D_METHOD("get_project_file_path"), &PsychProjectDescriptor::get_project_file_path);
	ClassDB::bind_method(D_METHOD("get_project_root_path"), &PsychProjectDescriptor::get_project_root_path);
	ClassDB::bind_method(D_METHOD("get_application_title"), &PsychProjectDescriptor::get_application_title);
	ClassDB::bind_method(D_METHOD("get_application_file"), &PsychProjectDescriptor::get_application_file);
	ClassDB::bind_method(D_METHOD("get_application_package"), &PsychProjectDescriptor::get_application_package);
	ClassDB::bind_method(D_METHOD("get_application_main_class"), &PsychProjectDescriptor::get_application_main_class);
	ClassDB::bind_method(D_METHOD("get_application_version"), &PsychProjectDescriptor::get_application_version);
	ClassDB::bind_method(D_METHOD("get_application_company"), &PsychProjectDescriptor::get_application_company);
	ClassDB::bind_method(D_METHOD("get_haxelib_dependencies"), &PsychProjectDescriptor::get_haxelib_dependencies);
	ClassDB::bind_method(D_METHOD("get_asset_rules"), &PsychProjectDescriptor::get_asset_rules);
	ClassDB::bind_method(D_METHOD("get_class_paths"), &PsychProjectDescriptor::get_class_paths);
	ClassDB::bind_method(D_METHOD("get_defines"), &PsychProjectDescriptor::get_defines);
	ClassDB::bind_method(D_METHOD("get_haxedefs"), &PsychProjectDescriptor::get_haxedefs);
	ClassDB::bind_method(D_METHOD("get_settings"), &PsychProjectDescriptor::get_settings);
	ClassDB::bind_method(D_METHOD("get_diagnostics"), &PsychProjectDescriptor::get_diagnostics);
	ClassDB::bind_method(D_METHOD("get_summary"), &PsychProjectDescriptor::get_summary);
}
