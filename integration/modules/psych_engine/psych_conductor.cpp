/**************************************************************************/
/*  psych_conductor.cpp                                                   */
/**************************************************************************/
/*                         This file is part of:                          */
/*                         GODOTTHINGY PSYCH BRIDGE                        */
/**************************************************************************/
/* Copyright (c) 2026 GODOTTHINGY contributors.                            */
/**************************************************************************/

#include "psych_conductor.h"

#include "core/math/math_funcs.h"
#include "core/object/class_db.h"

namespace {

static constexpr double POSITION_EPSILON_MS = 0.000001;
static constexpr double STEP_EPSILON = 0.000000001;
static constexpr double MS_PER_MINUTE = 60000.0;
static constexpr double STEPS_PER_BEAT = 4.0;
static constexpr double STEPS_PER_MEASURE = 16.0;

static bool _variant_is_number(const Variant &p_value) {
	return p_value.get_type() == Variant::INT || p_value.get_type() == Variant::FLOAT;
}

} // namespace

PsychConductor::PsychConductor() {
	TempoChange initial;
	initial.position_ms = 0.0;
	initial.bpm = 100.0;
	initial.step_at_position = 0.0;
	tempo_map.push_back(initial);
	set_process(false);
}

void PsychConductor::_rebuild_tempo_map() {
	if (tempo_map.is_empty()) {
		TempoChange initial;
		initial.position_ms = 0.0;
		initial.bpm = 100.0;
		initial.step_at_position = 0.0;
		tempo_map.push_back(initial);
		return;
	}

	tempo_map.write[0].position_ms = 0.0;
	tempo_map.write[0].step_at_position = 0.0;
	for (int i = 1; i < tempo_map.size(); i++) {
		const TempoChange &previous = tempo_map[i - 1];
		TempoChange &current = tempo_map.write[i];
		const double elapsed_ms = current.position_ms - previous.position_ms;
		current.step_at_position = previous.step_at_position + elapsed_ms * previous.bpm * STEPS_PER_BEAT / MS_PER_MINUTE;
	}
}

int PsychConductor::_find_tempo_segment_for_time(double p_position_ms) const {
	if (tempo_map.is_empty() || p_position_ms <= tempo_map[0].position_ms) {
		return 0;
	}

	int left = 0;
	int right = tempo_map.size();
	while (left < right) {
		const int middle = left + (right - left) / 2;
		if (tempo_map[middle].position_ms <= p_position_ms) {
			left = middle + 1;
		} else {
			right = middle;
		}
	}
	return MAX(0, left - 1);
}

int PsychConductor::_find_tempo_segment_for_step(double p_step) const {
	if (tempo_map.is_empty() || p_step <= tempo_map[0].step_at_position) {
		return 0;
	}

	int left = 0;
	int right = tempo_map.size();
	while (left < right) {
		const int middle = left + (right - left) / 2;
		if (tempo_map[middle].step_at_position <= p_step + STEP_EPSILON) {
			left = middle + 1;
		} else {
			right = middle;
		}
	}
	return MAX(0, left - 1);
}

bool PsychConductor::set_tempo_change(double p_position_ms, double p_bpm) {
	if (!Math::is_finite(p_position_ms) || !Math::is_finite(p_bpm) || p_position_ms < 0.0 || p_bpm <= 0.0) {
		return false;
	}

	if (tempo_map.is_empty()) {
		_rebuild_tempo_map();
	}

	TempoChange next;
	next.position_ms = p_position_ms;
	next.bpm = p_bpm;
	next.step_at_position = 0.0;

	if (p_position_ms <= POSITION_EPSILON_MS) {
		next.position_ms = 0.0;
		tempo_map.write[0] = next;
	} else {
		int insert_at = 1;
		while (insert_at < tempo_map.size() && tempo_map[insert_at].position_ms < p_position_ms - POSITION_EPSILON_MS) {
			insert_at++;
		}
		if (insert_at < tempo_map.size() && Math::abs(tempo_map[insert_at].position_ms - p_position_ms) <= POSITION_EPSILON_MS) {
			tempo_map.write[insert_at] = next;
		} else {
			tempo_map.insert(insert_at, next);
		}
	}

	_rebuild_tempo_map();
	if (running) {
		last_emitted_step = MAX(last_emitted_step, _step_at_current_position());
	}
	emit_signal("tempo_map_changed");
	return true;
}

bool PsychConductor::set_tempo_map(const Array &p_tempo_map) {
	Vector<TempoChange> candidate;
	TempoChange initial;
	initial.position_ms = 0.0;
	initial.bpm = get_bpm();
	initial.step_at_position = 0.0;
	candidate.push_back(initial);

	for (int i = 0; i < p_tempo_map.size(); i++) {
		if (p_tempo_map[i].get_type() != Variant::DICTIONARY) {
			return false;
		}
		const Dictionary item = p_tempo_map[i];
		const Variant position_value = item.get("position_ms", item.get("time_ms", Variant()));
		const Variant bpm_value = item.get("bpm", Variant());
		if (!_variant_is_number(position_value) || !_variant_is_number(bpm_value)) {
			return false;
		}

		const double position_ms = position_value;
		const double bpm = bpm_value;
		if (!Math::is_finite(position_ms) || !Math::is_finite(bpm) || position_ms < 0.0 || bpm <= 0.0) {
			return false;
		}

		TempoChange next;
		next.position_ms = position_ms;
		next.bpm = bpm;
		next.step_at_position = 0.0;
		if (position_ms <= POSITION_EPSILON_MS) {
			next.position_ms = 0.0;
			candidate.write[0] = next;
			continue;
		}

		int insert_at = 1;
		while (insert_at < candidate.size() && candidate[insert_at].position_ms < position_ms - POSITION_EPSILON_MS) {
			insert_at++;
		}
		if (insert_at < candidate.size() && Math::abs(candidate[insert_at].position_ms - position_ms) <= POSITION_EPSILON_MS) {
			candidate.write[insert_at] = next;
		} else {
			candidate.insert(insert_at, next);
		}
	}

	tempo_map = candidate;
	_rebuild_tempo_map();
	if (running) {
		last_emitted_step = MAX(last_emitted_step, _step_at_current_position());
	}
	emit_signal("tempo_map_changed");
	return true;
}

Array PsychConductor::get_tempo_map() const {
	Array result;
	for (int i = 0; i < tempo_map.size(); i++) {
		Dictionary item;
		item["position_ms"] = tempo_map[i].position_ms;
		item["bpm"] = tempo_map[i].bpm;
		item["step_at_position"] = tempo_map[i].step_at_position;
		result.push_back(item);
	}
	return result;
}

void PsychConductor::clear_tempo_changes() {
	const double current_bpm = get_bpm();
	tempo_map.clear();
	TempoChange initial;
	initial.position_ms = 0.0;
	initial.bpm = current_bpm;
	initial.step_at_position = 0.0;
	tempo_map.push_back(initial);
	if (running) {
		last_emitted_step = MAX(last_emitted_step, _step_at_current_position());
	}
	emit_signal("tempo_map_changed");
}

void PsychConductor::set_bpm(double p_bpm) {
	if (!Math::is_finite(p_bpm) || p_bpm <= 0.0) {
		ERR_PRINT("PsychConductor BPM must be a finite positive number.");
		return;
	}
	set_tempo_change(0.0, p_bpm);
}

double PsychConductor::get_bpm() const {
	return tempo_map.is_empty() ? 100.0 : tempo_map[0].bpm;
}

void PsychConductor::set_playback_rate(double p_rate) {
	if (!Math::is_finite(p_rate) || p_rate < 0.0 || p_rate > 16.0) {
		ERR_PRINT("PsychConductor playback rate must be between 0 and 16.");
		return;
	}
	playback_rate = p_rate;
}

double PsychConductor::get_playback_rate() const {
	return playback_rate;
}

void PsychConductor::set_max_audio_drift_ms(double p_threshold) {
	if (!Math::is_finite(p_threshold) || p_threshold < 0.0) {
		ERR_PRINT("PsychConductor audio drift threshold must be finite and non-negative.");
		return;
	}
	max_audio_drift_ms = p_threshold;
}

double PsychConductor::get_max_audio_drift_ms() const {
	return max_audio_drift_ms;
}

void PsychConductor::set_steps_per_section(int64_t p_steps) {
	if (p_steps < 1 || p_steps > 1024) {
		ERR_PRINT("PsychConductor section length must be between 1 and 1024 steps.");
		return;
	}
	steps_per_section = p_steps;
}

int64_t PsychConductor::get_steps_per_section() const {
	return steps_per_section;
}

void PsychConductor::set_song_position_ms(double p_position_ms) {
	seek(p_position_ms, false);
}

double PsychConductor::get_song_position_ms() const {
	return song_position_ms;
}

void PsychConductor::seek(double p_position_ms, bool p_emit_current_step) {
	if (!Math::is_finite(p_position_ms)) {
		return;
	}
	song_position_ms = MAX(0.0, p_position_ms);
	const int64_t target_step = _step_at_current_position();
	last_emitted_step = p_emit_current_step ? target_step - 1 : target_step;
	if (p_emit_current_step && running) {
		_dispatch_events_to_current_position();
	}
}

void PsychConductor::synchronize_to_audio_position_ms(double p_audio_position_ms) {
	if (!Math::is_finite(p_audio_position_ms) || p_audio_position_ms < 0.0) {
		return;
	}

	const double drift_ms = p_audio_position_ms - song_position_ms;
	if (Math::abs(drift_ms) > max_audio_drift_ms) {
		song_position_ms = p_audio_position_ms;
		last_emitted_step = _step_at_current_position() - 1;
		emit_signal("audio_resynchronized", drift_ms);
	} else {
		// A small proportional correction avoids accumulating audio-clock drift without a visible hard seek.
		song_position_ms += drift_ms * 0.25;
	}

	if (running) {
		_dispatch_events_to_current_position();
	}
}

void PsychConductor::start() {
	if (running) {
		return;
	}
	running = true;
	set_process(true);
	_dispatch_events_to_current_position();
}

void PsychConductor::stop() {
	running = false;
	set_process(false);
}

void PsychConductor::reset() {
	song_position_ms = 0.0;
	last_emitted_step = -1;
	if (running) {
		_dispatch_events_to_current_position();
	}
}

bool PsychConductor::is_running() const {
	return running;
}

double PsychConductor::get_step_at(double p_position_ms) const {
	if (!Math::is_finite(p_position_ms) || tempo_map.is_empty()) {
		return 0.0;
	}
	if (p_position_ms < 0.0) {
		return p_position_ms * tempo_map[0].bpm * STEPS_PER_BEAT / MS_PER_MINUTE;
	}

	const int segment = _find_tempo_segment_for_time(p_position_ms);
	const TempoChange &tempo = tempo_map[segment];
	return tempo.step_at_position + (p_position_ms - tempo.position_ms) * tempo.bpm * STEPS_PER_BEAT / MS_PER_MINUTE;
}

double PsychConductor::get_step_start_time_ms(double p_step) const {
	if (!Math::is_finite(p_step) || tempo_map.is_empty()) {
		return 0.0;
	}
	if (p_step < 0.0) {
		return p_step * MS_PER_MINUTE / (tempo_map[0].bpm * STEPS_PER_BEAT);
	}

	const int segment = _find_tempo_segment_for_step(p_step);
	const TempoChange &tempo = tempo_map[segment];
	return tempo.position_ms + (p_step - tempo.step_at_position) * MS_PER_MINUTE / (tempo.bpm * STEPS_PER_BEAT);
}

int64_t PsychConductor::_step_at_current_position() const {
	return (int64_t)Math::floor(get_step_at(song_position_ms) + STEP_EPSILON);
}

int64_t PsychConductor::get_current_step() const {
	return _step_at_current_position();
}

int64_t PsychConductor::get_current_beat() const {
	return _step_at_current_position() / 4;
}

int64_t PsychConductor::get_current_measure() const {
	return (int64_t)Math::floor((double)_step_at_current_position() / STEPS_PER_MEASURE);
}

int64_t PsychConductor::get_current_section() const {
	return (int64_t)Math::floor((double)_step_at_current_position() / (double)steps_per_section);
}

void PsychConductor::_dispatch_events_to_current_position() {
	const int64_t target_step = _step_at_current_position();
	if (target_step <= last_emitted_step) {
		return;
	}

	for (int64_t step = last_emitted_step + 1; step <= target_step; step++) {
		if (step < 0) {
			continue;
		}
		emit_signal("step_hit", step);
		if ((step % 4) == 0) {
			emit_signal("beat_hit", step / 4);
		}
		if ((step % (int64_t)STEPS_PER_MEASURE) == 0) {
			emit_signal("measure_hit", step / (int64_t)STEPS_PER_MEASURE);
		}
		if ((step % steps_per_section) == 0) {
			emit_signal("section_hit", step / steps_per_section);
		}
	}
	last_emitted_step = target_step;
}

void PsychConductor::_notification(int p_what) {
	if (p_what != NOTIFICATION_PROCESS || !running || playback_rate == 0.0) {
		return;
	}

	const double delta = get_process_delta_time();
	if (!Math::is_finite(delta) || delta < 0.0) {
		return;
	}
	song_position_ms += delta * 1000.0 * playback_rate;
	_dispatch_events_to_current_position();
}

void PsychConductor::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_tempo_change", "position_ms", "bpm"), &PsychConductor::set_tempo_change);
	ClassDB::bind_method(D_METHOD("set_tempo_map", "tempo_map"), &PsychConductor::set_tempo_map);
	ClassDB::bind_method(D_METHOD("get_tempo_map"), &PsychConductor::get_tempo_map);
	ClassDB::bind_method(D_METHOD("clear_tempo_changes"), &PsychConductor::clear_tempo_changes);
	ClassDB::bind_method(D_METHOD("set_bpm", "bpm"), &PsychConductor::set_bpm);
	ClassDB::bind_method(D_METHOD("get_bpm"), &PsychConductor::get_bpm);
	ClassDB::bind_method(D_METHOD("set_playback_rate", "rate"), &PsychConductor::set_playback_rate);
	ClassDB::bind_method(D_METHOD("get_playback_rate"), &PsychConductor::get_playback_rate);
	ClassDB::bind_method(D_METHOD("set_max_audio_drift_ms", "threshold_ms"), &PsychConductor::set_max_audio_drift_ms);
	ClassDB::bind_method(D_METHOD("get_max_audio_drift_ms"), &PsychConductor::get_max_audio_drift_ms);
	ClassDB::bind_method(D_METHOD("set_steps_per_section", "steps"), &PsychConductor::set_steps_per_section);
	ClassDB::bind_method(D_METHOD("get_steps_per_section"), &PsychConductor::get_steps_per_section);
	ClassDB::bind_method(D_METHOD("set_song_position_ms", "position_ms"), &PsychConductor::set_song_position_ms);
	ClassDB::bind_method(D_METHOD("get_song_position_ms"), &PsychConductor::get_song_position_ms);
	ClassDB::bind_method(D_METHOD("seek", "position_ms", "emit_current_step"), &PsychConductor::seek, DEFVAL(false));
	ClassDB::bind_method(D_METHOD("synchronize_to_audio_position_ms", "audio_position_ms"), &PsychConductor::synchronize_to_audio_position_ms);
	ClassDB::bind_method(D_METHOD("start"), &PsychConductor::start);
	ClassDB::bind_method(D_METHOD("stop"), &PsychConductor::stop);
	ClassDB::bind_method(D_METHOD("reset"), &PsychConductor::reset);
	ClassDB::bind_method(D_METHOD("is_running"), &PsychConductor::is_running);
	ClassDB::bind_method(D_METHOD("get_step_at", "position_ms"), &PsychConductor::get_step_at);
	ClassDB::bind_method(D_METHOD("get_step_start_time_ms", "step"), &PsychConductor::get_step_start_time_ms);
	ClassDB::bind_method(D_METHOD("get_current_step"), &PsychConductor::get_current_step);
	ClassDB::bind_method(D_METHOD("get_current_beat"), &PsychConductor::get_current_beat);
	ClassDB::bind_method(D_METHOD("get_current_measure"), &PsychConductor::get_current_measure);
	ClassDB::bind_method(D_METHOD("get_current_section"), &PsychConductor::get_current_section);

	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "bpm", PROPERTY_HINT_RANGE, "1,1000,0.01,or_greater"), "set_bpm", "get_bpm");
	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "song_position_ms", PROPERTY_HINT_RANGE, "0,3600000,0.1,or_greater"), "set_song_position_ms", "get_song_position_ms");
	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "playback_rate", PROPERTY_HINT_RANGE, "0,16,0.01"), "set_playback_rate", "get_playback_rate");
	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "max_audio_drift_ms", PROPERTY_HINT_RANGE, "0,500,0.1,or_greater"), "set_max_audio_drift_ms", "get_max_audio_drift_ms");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "steps_per_section", PROPERTY_HINT_RANGE, "1,1024,1"), "set_steps_per_section", "get_steps_per_section");

	ADD_SIGNAL(MethodInfo("step_hit", PropertyInfo(Variant::INT, "step_index")));
	ADD_SIGNAL(MethodInfo("beat_hit", PropertyInfo(Variant::INT, "beat_index")));
	ADD_SIGNAL(MethodInfo("measure_hit", PropertyInfo(Variant::INT, "measure_index")));
	ADD_SIGNAL(MethodInfo("section_hit", PropertyInfo(Variant::INT, "section_index")));
	ADD_SIGNAL(MethodInfo("tempo_map_changed"));
	ADD_SIGNAL(MethodInfo("audio_resynchronized", PropertyInfo(Variant::FLOAT, "drift_ms")));
}
