import { findSettings, upsertSettings } from '../crud/settings.js';
import type { SettingsDto } from '../schemas/settings.js';
import { today } from './dates.js';

export async function getSettings(userId: string): Promise<SettingsDto> {
	const row = await findSettings(userId);
	return row
		? { startingBalanceCents: row.startingBalanceCents, startingDate: row.startingDate }
		: { startingBalanceCents: 0, startingDate: today() };
}
export async function putSettings(userId: string, body: SettingsDto): Promise<SettingsDto> {
	const row = await upsertSettings(userId, body);
	return { startingBalanceCents: row.startingBalanceCents, startingDate: row.startingDate };
}
