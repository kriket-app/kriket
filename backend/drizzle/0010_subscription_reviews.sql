ALTER TABLE "subscription_digests" ALTER COLUMN "sent_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_streams" ADD COLUMN "subscription_since" date;--> statement-breakpoint
ALTER TABLE "income_streams" ADD COLUMN "subscription_since" date;--> statement-breakpoint
ALTER TABLE "subscription_digests" ADD COLUMN "next_review_on" date;--> statement-breakpoint
UPDATE "subscription_digests" SET "next_review_on" = "sent_on" + 90;--> statement-breakpoint
ALTER TABLE "subscription_digests" ALTER COLUMN "next_review_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_digests" ADD COLUMN "last_attempt_on" date;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "preset_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_preset_idx" ON "tags" USING btree ("user_id","preset_key");--> statement-breakpoint
UPDATE "expense_streams" SET "is_subscription" = true WHERE "tag_id" IN (SELECT "id" FROM "tags" WHERE lower(trim("name")) IN ('subscription', 'subscriptions'));--> statement-breakpoint
UPDATE "expense_streams" SET "subscription_since" = (now() AT TIME ZONE 'America/Regina')::date WHERE "is_subscription" = true;
