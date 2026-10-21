/**************************************************************************/
/*  psych_conductor.h                                                     */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#pragma once

#include "core/templates/vector.h"
#include "scene/main/node.h"

class PsychConductor : public Node {
	GDCLASS(PsychConductor, Node);

	struct TempoChange {
		double position_ms = 0.0;
		double bpm = 100.0;
		double step_at_position = 0.0;
	};

	Vector<TempoChange> tempo_map;
	double song_position_ms = 0.0;
	double playback_rate = 1.0;
	double max_audio_drift_ms = 25.0;
	int64_t last_emitted_step = -1;
	int64_t steps_per_section = 16;
	bool running = false;

	void _rebuild_tempo_map();
	int _find_tempo_segment_for_time(double p_position_ms) const;
	int _find_tempo_segment_for_step(double p_step) const;
	int64_t _step_at_current_position() const;
	void _dispatch_events_to_current_position();
	void _notification(int p_what);

protected:
	static void _bind_methods();

public:
	bool set_tempo_change(double p_position_ms, double p_bpm);
	bool set_tempo_map(const Array &p_tempo_map);
	Array get_tempo_map() const;
	void clear_tempo_changes();

	void set_bpm(double p_bpm);
	double get_bpm() const;
	void set_playback_rate(double p_rate);
	double get_playback_rate() const;
	void set_max_audio_drift_ms(double p_threshold);
	double get_max_audio_drift_ms() const;
	void set_steps_per_section(int64_t p_steps);
	int64_t get_steps_per_section() const;

	void set_song_position_ms(double p_position_ms);
	double get_song_position_ms() const;
	void seek(double p_position_ms, bool p_emit_current_step = false);
	void synchronize_to_audio_position_ms(double p_audio_position_ms);
	void start();
	void stop();
	void reset();
	bool is_running() const;

	double get_step_at(double p_position_ms) const;
	double get_step_start_time_ms(double p_step) const;
	int64_t get_current_step() const;
	int64_t get_current_beat() const;
	int64_t get_current_measure() const;
	int64_t get_current_section() const;

	PsychConductor();
};
