import { findLastAlert, recordAlert } from '../crud/alerts.js';
import { listUserIdsWithSubscriptions } from '../crud/push.js';
import { logger } from '../logger.js';
import type { ForecastDto } from '../schemas/forecast.js';
import { addDays, daysBetween, toUtc, today } from './dates.js';
import { getForecast } from './forecast.js';
import { pushEnabled, sendToUser, type PushPayload } from './push.js';
import { getSettings } from './settings.js';

// Low-balance heads-ups. Several times a day, for each user with a device subscribed, look at the
// expected case (the middle line of the chart) for the next week and send one notification when
// it is about to go below zero.

/** How far ahead a dip counts as "about to happen". */
export const ALERT_HORIZON_DAYS = 7;
/** A forecast from a balance this old is too stale to alert on. */
const MAX_BALANCE_AGE_DAYS = 365;
/** Undelivered alerts expire after half a day; the next sweep sends a fresh one if still true. */
const ALERT_TTL_SECONDS = 12 * 60 * 60;
/** Newer undelivered alerts replace older ones on the push service. */
const ALERT_TOPIC = 'forecast-dip';

export type Dip = { date: string; balanceCents: number };

/**
 * The first day in [from, from + horizonDays] on which the expected balance drops below zero.
 * Only the start of a run below zero counts: a balance that was already negative the day
 * before `from`, or that the user entered as negative, is not a new dip, so a user in the red
 * is not told again every morning.
 */
export function findUpcomingDip(
	forecast: ForecastDto,
	from: string,
	horizonDays: number
): Dip | null {
	const until = addDays(from, horizonDays);
	// The entered balance, before anything due on its own date.
	let previous = forecast.startingBalanceCents;
	for (const point of forecast.points) {
		if (point.date > until) break;
		const startsRun = point.actualCents < 0 && previous >= 0;
		if (point.date >= from && startsRun) {
			return { date: point.date, balanceCents: point.actualCents };
		}
		previous = point.actualCents;
	}
	return null;
}

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const day = new Intl.DateTimeFormat('en-CA', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

export function describeDip(dip: Dip, from: string): PushPayload {
	const daysAway = daysBetween(from, dip.date);
	const when =
		daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `on ${day.format(toUtc(dip.date))}`;
	return {
		title: 'Heads-up: money is running short',
		body: `Your expected balance drops to ${money.format(dip.balanceCents / 100)} ${when}. Open kriket to see what's coming.`,
		url: '/app'
	};
}

// A device that keeps failing in some way other than being revoked (a key mismatch, say) would
// otherwise get a try every sweep all day. In memory is enough: a restart only allows a few more.
const MAX_FAILED_TRIES_PER_DAY = 3;
const failedTries = new Map<string, { day: string; count: number }>();

/** Checks one user; true when an alert went out. */
async function alertUser(userId: string, from: string) {
	const settings = await getSettings(userId);
	const balanceAge = daysBetween(settings.startingDate, from);
	if (balanceAge > MAX_BALANCE_AGE_DAYS) return false;

	// The forecast starts at the balance date, so reach far enough to cover the coming week.
	const forecast = await getForecast(userId, Math.max(0, balanceAge) + ALERT_HORIZON_DAYS);
	const dip = findUpcomingDip(forecast, from, ALERT_HORIZON_DAYS);
	if (!dip) return false;

	const last = await findLastAlert(userId);
	if (last && (last.dipDate === dip.date || last.sentOn === from)) return false;

	const tries = failedTries.get(userId);
	if (tries && tries.day === from && tries.count >= MAX_FAILED_TRIES_PER_DAY) return false;

	const result = await sendToUser(userId, describeDip(dip, from), {
		ttlSeconds: ALERT_TTL_SECONDS,
		topic: ALERT_TOPIC
	});
	// Nothing reached a device: leave no record, so a later sweep tries again, a few times a day.
	if (result.sent === 0) {
		failedTries.set(userId, { day: from, count: tries?.day === from ? tries.count + 1 : 1 });
		return false;
	}
	failedTries.delete(userId);
	await recordAlert(userId, dip.date, from);
	return true;
}

/** One pass over every user with a device subscribed. `from` is the day to look ahead from. */
export async function sweepForecastAlerts(from: string = today()) {
	if (!pushEnabled()) return { checked: 0, alerted: 0, failed: 0 };
	for (const [userId, tries] of failedTries) {
		if (tries.day !== from) failedTries.delete(userId);
	}
	const userIds = await listUserIdsWithSubscriptions();
	let alerted = 0;
	let failed = 0;
	// One user at a time: the user count is small and this keeps the database pool free for requests.
	for (const userId of userIds) {
		try {
			if (await alertUser(userId, from)) alerted += 1;
		} catch (error) {
			failed += 1;
			logger.error({ userId, err: error }, 'Forecast alert check failed');
		}
	}
	return { checked: userIds.length, alerted, failed };
}

// The sweep runs only in waking hours, in the same fixed timezone as today() in services/dates.ts.
const SWEEP_EVERY_MS = 15 * 60 * 1000;
const FIRST_HOUR = 9;
const LAST_HOUR = 20;
const hourFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'America/Regina',
	hour: 'numeric',
	hourCycle: 'h23'
});

export function inAlertHours(now: Date) {
	const hour = Number(hourFormat.format(now));
	return hour >= FIRST_HOUR && hour <= LAST_HOUR;
}

/** Starts the sweep timer; returns a function that stops it. Does nothing while push is off. */
export function startForecastAlerts() {
	let running = false;
	const tick = async () => {
		if (running || !pushEnabled() || !inAlertHours(new Date())) return;
		running = true;
		try {
			const result = await sweepForecastAlerts();
			if (result.checked > 0) logger.info(result, 'Forecast alert sweep finished');
		} catch (error) {
			logger.error({ err: error }, 'Forecast alert sweep failed');
		} finally {
			running = false;
		}
	};
	const timer = setInterval(() => void tick(), SWEEP_EVERY_MS);
	timer.unref();
	void tick();
	return () => clearInterval(timer);
}
