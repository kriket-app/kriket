// PWA shell theme (light/dark/system). SSR-safe: DOM and storage are only
// touched in the browser. The pre-hydration snippet in app.html applies the
// stored choice before first paint; initTheme() keeps the class in sync after
// hydration and follows the OS while the choice is "system".
import { browser } from '$app/environment';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'kriket-theme';

export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

function prefersDark() {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(choice: ThemeChoice) {
	document.documentElement.classList.toggle(
		'dark',
		choice === 'dark' || (choice === 'system' && prefersDark())
	);
}

let current = $state<ThemeChoice>('system');

export const theme = {
	get choice(): ThemeChoice {
		return current;
	}
};

export function setTheme(choice: ThemeChoice) {
	current = choice;
	if (!browser) return;
	try {
		localStorage.setItem(KEY, choice);
	} catch {
		// Private browsing etc: the choice just doesn't persist.
	}
	apply(choice);
}

export function initTheme() {
	if (!browser) return;
	let stored: ThemeChoice = 'system';
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
	} catch {
		// Unreadable storage: fall back to the system theme.
	}
	current = stored;
	apply(stored);
	// Follow the OS while the user hasn't picked a side.
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (current === 'system') apply('system');
	});
}
