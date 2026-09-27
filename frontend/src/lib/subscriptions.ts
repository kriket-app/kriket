// Curated subscription catalog for name autofill. Local and offline-safe: brand icons
// load from the Simple Icons CDN when online, with an emoji fallback otherwise.
// Slugs follow https://simpleicons.org (lowercase, no spaces); `emoji` is the offline face.

export interface SubscriptionPreset {
	name: string;
	aliases?: string[];
	slug?: string;
	emoji: string;
}

export const SUBSCRIPTION_PRESETS: SubscriptionPreset[] = [
	{ name: 'Netflix', slug: 'netflix', emoji: '🎬' },
	{ name: 'Spotify', slug: 'spotify', emoji: '🎵' },
	{ name: 'Disney+', slug: 'disneyplus', emoji: '✨' },
	{ name: 'YouTube Premium', aliases: ['YouTube'], slug: 'youtube', emoji: '▶️' },
	{ name: 'Apple Music', slug: 'applemusic', emoji: '🍎' },
	{ name: 'iCloud+', aliases: ['iCloud'], slug: 'icloud', emoji: '☁️' },
	{ name: 'Amazon Prime', aliases: ['Prime'], slug: 'amazonprime', emoji: '📦' },
	{ name: 'Audible', slug: 'audible', emoji: '🎧' },
	{ name: 'Kindle Unlimited', slug: 'amazonkindle', emoji: '📚' },
	{ name: 'HBO Max', aliases: ['Max'], slug: 'hbomax', emoji: '🎭' },
	{ name: 'Hulu', slug: 'hulu', emoji: '💚' },
	{ name: 'Apple TV+', slug: 'appletv', emoji: '📺' },
	{ name: 'Paramount+', slug: 'paramountplus', emoji: '⛰️' },
	{ name: 'Peacock', slug: 'peacock', emoji: '🦚' },
	{ name: 'Crunchyroll', slug: 'crunchyroll', emoji: '🍥' },
	{ name: 'Twitch Turbo', slug: 'twitch', emoji: '💜' },
	{ name: 'Xbox Game Pass', aliases: ['Game Pass'], slug: 'xbox', emoji: '🎮' },
	{ name: 'PlayStation Plus', aliases: ['PS Plus'], slug: 'playstation', emoji: '🎮' },
	{ name: 'Nintendo Switch Online', slug: 'nintendo', emoji: '🎮' },
	{ name: 'Discord Nitro', slug: 'discord', emoji: '💬' },
	{ name: 'ChatGPT Plus', aliases: ['ChatGPT'], slug: 'openai', emoji: '🤖' },
	{ name: 'GitHub Copilot', slug: 'githubcopilot', emoji: '💻' },
	{ name: 'Microsoft 365', aliases: ['Office 365'], slug: 'microsoftoffice', emoji: '📎' },
	{ name: 'Google One', slug: 'googleone', emoji: '💾' },
	{ name: 'Dropbox', slug: 'dropbox', emoji: '📁' },
	{ name: '1Password', slug: '1password', emoji: '🔑' },
	{ name: 'Notion', slug: 'notion', emoji: '📝' },
	{ name: 'Strava', slug: 'strava', emoji: '🏃' },
	{ name: 'The New York Times', aliases: ['NYT'], slug: 'newyorktimes', emoji: '📰' },
	{ name: 'The Athletic', slug: 'theathletic', emoji: '⚽' },
	{ name: 'Patreon', slug: 'patreon', emoji: '❤️' },
	{ name: 'Duolingo', slug: 'duolingo', emoji: '🦉' }
];

export const iconUrlFor = (preset: SubscriptionPreset): string | null =>
	preset.slug ? `https://cdn.simpleicons.org/${preset.slug}` : null;

export function matchPresets(query: string, limit = 8): SubscriptionPreset[] {
	const q = query.trim().toLowerCase();
	if (!q) return SUBSCRIPTION_PRESETS.slice(0, limit);
	return SUBSCRIPTION_PRESETS.filter(
		(p) =>
			p.name.toLowerCase().includes(q) || (p.aliases ?? []).some((a) => a.toLowerCase().includes(q))
	).slice(0, limit);
}

export function presetForName(name: string): SubscriptionPreset | undefined {
	const q = name.trim().toLowerCase();
	if (!q) return undefined;
	return SUBSCRIPTION_PRESETS.find(
		(p) => p.name.toLowerCase() === q || (p.aliases ?? []).some((a) => a.toLowerCase() === q)
	);
}
