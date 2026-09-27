ALTER TABLE "expense_streams" ADD COLUMN "recurrence" text DEFAULT 'days' NOT NULL;--> statement-breakpoint
ALTER TABLE "income_streams" ADD COLUMN "recurrence" text DEFAULT 'days' NOT NULL;