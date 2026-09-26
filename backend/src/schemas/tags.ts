import { z } from 'zod';
import { registry } from '../openapi/registry.js';

export const Tag = registry.register(
	'Tag',
	z.object({
		id: z.string(),
		name: z.string(),
		color: z.string().nullable(),
		isPreset: z.boolean(),
		createdAt: z.string().openapi({ format: 'date-time' })
	})
);
export const TagList = registry.register('TagList', z.object({ tags: z.array(Tag) }));
export const CreateTagBody = registry.register(
	'CreateTagBody',
	z.object({
		name: z.string().trim().min(1).max(40).openapi({ example: 'Groceries' }),
		color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().openapi({ example: '#16a34a' })
	})
);
export const UpdateTagBody = registry.register('UpdateTagBody', CreateTagBody.partial());
export type TagDto = z.infer<typeof Tag>;
