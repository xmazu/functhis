CREATE TYPE "public"."package_visibility" AS ENUM('private', 'organization', 'library');--> statement-breakpoint
CREATE TABLE "execution" (
	"caller_user_id" text,
	"cpu_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"function_id" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_version_id" text NOT NULL,
	"request_bytes" integer,
	"response_bytes" integer,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_version" (
	"artifacts_commit" text NOT NULL,
	"bundle_hash" text NOT NULL,
	"contracts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package" (
	"artifacts_repo_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_version_id" text,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"owner_user_id" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"visibility" "package_visibility" DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "function" (
	"contract" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"export_name" text NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" text NOT NULL,
	"path" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "handle" text;--> statement-breakpoint
UPDATE "user" SET "handle" = 'user-' || substring(replace("id", '-', '') from 1 for 12) WHERE "handle" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "handle" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_caller_user_id_user_id_fk" FOREIGN KEY ("caller_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_function_id_function_id_fk" FOREIGN KEY ("function_id") REFERENCES "public"."function"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_package_version_id_package_version_id_fk" FOREIGN KEY ("package_version_id") REFERENCES "public"."package_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_version" ADD CONSTRAINT "package_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_version" ADD CONSTRAINT "package_version_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_current_version_id_package_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."package_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function" ADD CONSTRAINT "function_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execution_package_version_id_idx" ON "execution" USING btree ("package_version_id");--> statement-breakpoint
CREATE INDEX "execution_created_at_idx" ON "execution" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "execution_caller_user_id_idx" ON "execution" USING btree ("caller_user_id");--> statement-breakpoint
CREATE INDEX "package_version_package_id_idx" ON "package_version" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "package_owner_user_id_slug_uidx" ON "package" USING btree ("owner_user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "package_artifacts_repo_name_uidx" ON "package" USING btree ("artifacts_repo_name");--> statement-breakpoint
CREATE INDEX "package_owner_user_id_idx" ON "package" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "package_organization_id_idx" ON "package" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "function_package_id_slug_uidx" ON "function" USING btree ("package_id","slug");--> statement-breakpoint
CREATE INDEX "function_package_id_idx" ON "function" USING btree ("package_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_handle_unique" UNIQUE("handle");