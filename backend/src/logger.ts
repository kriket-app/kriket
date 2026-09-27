import { pino } from 'pino';

// The process logger for work that runs outside a request: startup, shutdown, and the
// forecast alert sweep. Request handlers log through req.log (pino-http in app.ts).
export const logger = pino({
	level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info')
});
