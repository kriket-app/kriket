CREATE TABLE "forecast_alerts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"dip_date" date NOT NULL,
	"sent_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forecast_alerts" ADD CONSTRAINT "forecast_alerts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;