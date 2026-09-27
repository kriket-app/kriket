import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createApp } from './app.js';
import { db, pool } from './db/index.js';
import { validateEnv } from './env.js';
import { logger } from './logger.js';
import { startForecastAlerts } from './services/alerts.js';
import { startSubscriptionDigests } from './services/subscription-digests.js';

const env = validateEnv();
if (!env.success) {
	console.error('Invalid environment configuration:');
	for (const issue of env.error.issues) {
		console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
	}
	process.exit(1);
}

const port = env.data.PORT;

async function main() {
	await migrate(db, { migrationsFolder: './drizzle' });
	const app = createApp();
	const server = app.listen(port, () => {
		logger.info({ port }, 'Backend listening');
	});
	// Low-balance push alerts; each sweep is a no-op while the VAPID keys are unset.
	const stopAlerts = startForecastAlerts();
	// Quarterly subscription cleanup nudges share the same waking-hours window.
	const stopDigests = startSubscriptionDigests();

	const shutdown = (signal: NodeJS.Signals) => {
		logger.info({ signal }, 'Shutting down');
		stopAlerts();
		stopDigests();
		server.close(async () => {
			await pool.end();
			logger.info('Shutdown complete');
			process.exit(0);
		});
		setTimeout(() => process.exit(1), 10_000).unref();
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
}

main().catch((error) => {
	logger.error(error, 'Failed to start backend');
	process.exit(1);
});
