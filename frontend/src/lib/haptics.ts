// Best-effort touch feedback. Vibration is Android-only; everywhere else these
// are silent no-ops (iOS Safari has no vibration API).
export function tap() {
	try {
		navigator.vibrate?.(10);
	} catch {
		// Haptics are best-effort.
	}
}

/** A silent "chirp-chirp": two short buzzes for saved/celebrated moments. */
export function chirp() {
	try {
		navigator.vibrate?.([10, 40, 10]);
	} catch {
		// Haptics are best-effort.
	}
}
