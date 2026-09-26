import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

export const Settings = registry.register(
	'Settings',
	z.object({
		startingBalanceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000).openapi({ example: 42000 }),
		startingDate: isoDate
	})
);
export type SettingsDto = z.infer<typeof Settings>;
