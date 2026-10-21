extends SceneTree

func _initialize() -> void:
	_test_conductor()
	_test_project_descriptor()
	print("Psych native module tests passed")
	quit(0)

func _test_conductor() -> void:
	var conductor := PsychConductor.new()
	assert(is_equal_approx(conductor.bpm, 100.0))
	assert(is_equal_approx(conductor.get_step_at(150.0), 1.0))
	assert(is_equal_approx(conductor.get_step_start_time_ms(4.0), 600.0))

	assert(conductor.set_tempo_change(600.0, 200.0))
	assert(is_equal_approx(conductor.get_step_at(600.0), 4.0))
	assert(is_equal_approx(conductor.get_step_at(750.0), 6.0))
	assert(is_equal_approx(conductor.get_step_start_time_ms(6.0), 750.0))

	var original_bpm: float = conductor.bpm
	assert(not conductor.set_tempo_change(-1.0, 120.0))
	assert(not conductor.set_tempo_change(1000.0, 0.0))
	assert(is_equal_approx(conductor.bpm, original_bpm))

	var emitted_steps: Array[int] = []
	conductor.step_hit.connect(func(step_index: int) -> void: emitted_steps.append(step_index))
	conductor.start()
	assert(emitted_steps == [0])
	conductor.seek(150.0, true)
	assert(emitted_steps == [0, 1])
	conductor.stop()
	conductor.free()

func _test_project_descriptor() -> void:
	var descriptor := PsychProjectDescriptor.new()
	assert(descriptor.parse_file("res://fixtures/Project.xml") == OK)
	assert(descriptor.is_valid())
	assert(descriptor.get_application_title() == "Native Bridge Fixture")
	assert(descriptor.get_application_main_class() == "Main")
	assert(descriptor.get_haxelib_dependencies().size() == 2)
	assert(descriptor.get_class_paths().size() == 1)
	assert(descriptor.get_asset_rules().size() == 1)
	assert(descriptor.get_diagnostics().is_empty())
	descriptor = null

	var invalid_descriptor := PsychProjectDescriptor.new()
	assert(invalid_descriptor.parse_file("res://fixtures/InvalidProject.xml") == ERR_INVALID_DATA)
	assert(not invalid_descriptor.is_valid())
	assert(not invalid_descriptor.get_error_message().is_empty())
	invalid_descriptor = null
