CREATE TABLE "balance_checkins" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"balance_cents" integer NOT NULL,
	"checked_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_checkins" ADD CONSTRAINT "balance_checkins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "balance_checkins_user_day_idx" ON "balance_checkins" USING btree ("user_id","checked_on");--> statement-breakpoint
INSERT INTO "balance_checkins" ("user_id", "balance_cents", "checked_on")
SELECT "user_id", "starting_balance_cents", "starting_date" FROM "user_settings";--> statement-breakpoint
DROP TABLE "user_settings" CASCADE;