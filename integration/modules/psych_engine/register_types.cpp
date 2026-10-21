/**************************************************************************/
/*  register_types.cpp                                                    */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#include "register_types.h"

#include "core/object/class_db.h"
#include "psych_conductor.h"
#include "psych_project_descriptor.h"

#ifdef TOOLS_ENABLED
#include "editor/psych_project_editor_plugin.h"
#include "editor/plugins/editor_plugin.h"
#endif

void initialize_psych_engine_module(ModuleInitializationLevel p_level) {
	if (p_level == MODULE_INITIALIZATION_LEVEL_SCENE) {
		GDREGISTER_CLASS(PsychConductor);
		GDREGISTER_CLASS(PsychProjectDescriptor);
	}

#ifdef TOOLS_ENABLED
	if (p_level == MODULE_INITIALIZATION_LEVEL_EDITOR) {
		EditorPlugins::add_by_type<PsychProjectEditorPlugin>();
	}
#endif
}

void uninitialize_psych_engine_module(ModuleInitializationLevel p_level) {
	if (p_level != MODULE_INITIALIZATION_LEVEL_SCENE) {
		return;
	}
}
