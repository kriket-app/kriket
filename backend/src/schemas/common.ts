import { z } from 'zod';
import { registry } from '../openapi/registry.js';

export const IdParams = z.object({ id: z.string().uuid() });
export const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
	.openapi({ example: '2026-10-01' });
export const cents = z.number().int().min(0).max(1_000_000_000).openapi({
	example: 150000,
	description: 'integer cents'
});
export const ErrorMessage = registry.register('ErrorMessage', z.object({ message: z.string() }));
export const ValidationError = registry.register(
	'ValidationError',
	z.object({
		error: z.object({
			message: z.string(),
			details: z.array(z.object({ path: z.string(), message: z.string() }))
		})
	})
);
export const unauthorized = {
	401: { description: 'Not authenticated', content: { 'application/json': { schema: ErrorMessage } } }
};
export const notFound = {
	404: { description: 'Not found', content: { 'application/json': { schema: ErrorMessage } } }
};
export const badRequest = {
	400: { description: 'Invalid body', content: { 'application/json': { schema: ValidationError } } }
};
