CREATE TABLE "user_onboarding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"privacy_version" text,
	"terms_version" text,
	"privacy_accepted_at" timestamp,
	"terms_accepted_at" timestamp,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;