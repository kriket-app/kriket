import type { ForecastPointDto } from '../schemas/forecast.js';
import type { CreateGoalInput, GoalDto, GoalStatusDto, UpdateGoalInput } from '../schemas/goals.js';
import { findGoal, insertGoal, listGoals, removeGoal, updateGoal } from '../crud/goals.js';
import type { GoalRow } from '../crud/goals.js';
import { getForecast } from './forecast.js';
import { addDays, daysBetween, monthsBetween, today } from './dates.js';
import { InvalidInputError, NotFoundError } from './errors.js';

/** kriket forecasts at most 366 days ahead (see ForecastQuery's maximum). */
export const FORECAST_LIMIT_DAYS = 366;

export function goalStatus(
	targetDate: string,
	points: ForecastPointDto[],
	todayIso: string,
	amountCents: number
): GoalStatusDto {
	if (targetDate < todayIso) {
		return {
			state: 'past',
			expectedCents: null,
			worstCents: null,
			bestCents: null,
			monthlyNeededCents: null
		};
	}
	if (targetDate > addDays(todayIso, FORECAST_LIMIT_DAYS)) {
		return {
			state: 'beyond',
			expectedCents: null,
			worstCents: null,
			bestCents: null,
			monthlyNeededCents: null
		};
	}
	const point = points.find((p) => p.date === targetDate);
	if (!point)
		throw new Error(`Forecast does not reach goal date ${targetDate}: a bug, not a user error`);
	const months = monthsBetween(todayIso, targetDate);
	return {
		state: 'forecast',
		expectedCents: point.actualCents,
		worstCents: point.minCents,
		bestCents: point.maxCents,
		monthlyNeededCents: Math.max(0, Math.ceil((amountCents - point.actualCents) / months))
	};
}

export const toGoalDto = (row: GoalRow, status: GoalStatusDto): GoalDto => ({
	id: row.id,
	name: row.name,
	description: row.description,
	amountCents: row.amountCents,
	targetDate: row.targetDate,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString(),
	status
});

function assertTargetDate(targetDate: string | undefined) {
	if (targetDate !== undefined && targetDate < today()) {
		throw new InvalidInputError('Invalid request', [
			{ path: 'targetDate', message: 'Pick today or a later date' }
		]);
	}
}

async function statusFor(row: GoalRow): Promise<GoalStatusDto> {
	const now = today();
	if (row.targetDate < now || row.targetDate > addDays(now, FORECAST_LIMIT_DAYS)) {
		return goalStatus(row.targetDate, [], now, row.amountCents);
	}
	const days = Math.max(7, daysBetween(now, row.targetDate));
	const forecast = await getForecast(row.userId, days);
	return goalStatus(row.targetDate, forecast.points, now, row.amountCents);
}

export async function listGoalsWithStatus(userId: string) {
	const now = today();
	const rows = await listGoals(userId);
	const inForecast = rows.filter(
		(r) => r.targetDate >= now && r.targetDate <= addDays(now, FORECAST_LIMIT_DAYS)
	);
	// One forecast per distinct horizon would be wasteful; a single forecast to the
	// furthest goal covers every nearer goal's date.
	if (inForecast.length > 0) {
		const furthest = inForecast.reduce((a, b) => (a.targetDate > b.targetDate ? a : b));
		const days = Math.max(7, daysBetween(now, furthest.targetDate));
		const forecast = await getForecast(userId, days);
		return {
			goals: rows.map((row) =>
				toGoalDto(row, goalStatus(row.targetDate, forecast.points, now, row.amountCents))
			),
			today: now
		};
	}
	return {
		goals: rows.map((row) => toGoalDto(row, goalStatus(row.targetDate, [], now, row.amountCents))),
		today: now
	};
}

export async function createGoal(userId: string, body: CreateGoalInput): Promise<GoalDto> {
	assertTargetDate(body.targetDate);
	const row = await insertGoal(userId, {
		name: body.name,
		description: body.description ?? null,
		amountCents: body.amountCents,
		targetDate: body.targetDate
	});
	return toGoalDto(row, await statusFor(row));
}

export async function getGoal(userId: string, id: string): Promise<GoalDto> {
	const row = await findGoal(userId, id);
	if (!row) throw new NotFoundError('Goal not found');
	return toGoalDto(row, await statusFor(row));
}

export async function updateGoalById(
	userId: string,
	id: string,
	patch: UpdateGoalInput
): Promise<GoalDto> {
	const current = await findGoal(userId, id);
	if (!current) throw new NotFoundError('Goal not found');
	if (Object.keys(patch).length === 0) return toGoalDto(current, await statusFor(current));
	assertTargetDate(patch.targetDate);
	const row = await updateGoal(userId, id, {
		...(patch.name !== undefined ? { name: patch.name } : {}),
		...(patch.description !== undefined ? { description: patch.description } : {}),
		...(patch.amountCents !== undefined ? { amountCents: patch.amountCents } : {}),
		...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {})
	});
	if (!row) throw new NotFoundError('Goal not found');
	return toGoalDto(row, await statusFor(row));
}

export async function removeGoalById(userId: string, id: string): Promise<void> {
	if (!(await removeGoal(userId, id))) throw new NotFoundError('Goal not found');
}
