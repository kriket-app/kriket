-- Iteration 1's "As of" balance let a future date through, and migration 0003 copied it
-- straight into checked_on, where it then stayed "the latest" check-in forever. Move a future
-- check-in back to today when the user has no check-in for today yet; drop it when they already
-- do (they already have a real one for today).
UPDATE "balance_checkins"
SET "checked_on" = (now() AT TIME ZONE 'America/Regina')::date
WHERE "checked_on" > (now() AT TIME ZONE 'America/Regina')::date
	AND NOT EXISTS (
		SELECT 1 FROM "balance_checkins" AS "today_row"
		WHERE "today_row"."user_id" = "balance_checkins"."user_id"
			AND "today_row"."checked_on" = (now() AT TIME ZONE 'America/Regina')::date
	);
--> statement-breakpoint
DELETE FROM "balance_checkins"
WHERE "checked_on" > (now() AT TIME ZONE 'America/Regina')::date;
