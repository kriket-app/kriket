CREATE TABLE "subscription_digests" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sent_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_streams" ADD COLUMN "is_subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "income_streams" ADD COLUMN "is_subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_digests" ADD CONSTRAINT "subscription_digests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;