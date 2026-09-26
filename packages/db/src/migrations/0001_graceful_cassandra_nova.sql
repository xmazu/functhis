CREATE TABLE "secret" (
	"ciphertext" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"nonce" text NOT NULL,
	"organization_id" text NOT NULL,
	"package_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "secret_names" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "secret" ADD CONSTRAINT "secret_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret" ADD CONSTRAINT "secret_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret" ADD CONSTRAINT "secret_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "secret_org_name_uidx" ON "secret" USING btree ("organization_id","name") WHERE "secret"."package_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "secret_package_name_uidx" ON "secret" USING btree ("package_id","name") WHERE "secret"."package_id" is not null;--> statement-breakpoint
CREATE INDEX "secret_organization_id_idx" ON "secret" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "secret_package_id_idx" ON "secret" USING btree ("package_id");