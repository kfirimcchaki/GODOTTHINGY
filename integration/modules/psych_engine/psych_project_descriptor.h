/**************************************************************************/
/*  psych_project_descriptor.h                                            */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#pragma once

#include "core/variant/array.h"
#include "core/variant/dictionary.h"
#include "core/variant/variant.h"
#include "core/object/ref_counted.h"
#include "core/templates/vector.h"

class PsychProjectDescriptor : public RefCounted {
	GDCLASS(PsychProjectDescriptor, RefCounted);

	String project_file_path;
	String project_root_path;
	String application_title;
	String application_file;
	String application_package;
	String application_main_class;
	String application_version;
	String application_company;
	String error_message;
	bool valid = false;

	Array haxelib_dependencies;
	Array asset_rules;
	Array class_paths;
	Array defines;
	Array haxedefs;
	Array settings;
	Array diagnostics;

	void _clear();
	void _add_diagnostic(const String &p_severity, const String &p_message, const String &p_path = "");
	String _build_effective_condition(const Vector<String> &p_section_conditions, const String &p_if, const String &p_unless) const;
	void _validate_paths();

protected:
	static void _bind_methods();

public:
	Error parse_file(const String &p_file_path);

	bool is_valid() const;
	String get_error_message() const;
	String get_project_file_path() const;
	String get_project_root_path() const;
	String get_application_title() const;
	String get_application_file() const;
	String get_application_package() const;
	String get_application_main_class() const;
	String get_application_version() const;
	String get_application_company() const;

	Array get_haxelib_dependencies() const;
	Array get_asset_rules() const;
	Array get_class_paths() const;
	Array get_defines() const;
	Array get_haxedefs() const;
	Array get_settings() const;
	Array get_diagnostics() const;
	Dictionary get_summary() const;

	PsychProjectDescriptor() = default;
};
