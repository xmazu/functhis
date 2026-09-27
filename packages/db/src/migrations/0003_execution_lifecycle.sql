ALTER TABLE "execution" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
UPDATE "execution" AS e
SET "organization_id" = p."organization_id"
FROM "package_version" AS v
INNER JOIN "package" AS p ON p."id" = v."package_id"
WHERE e."package_version_id" = v."id";--> statement-breakpoint
ALTER TABLE "execution" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execution_organization_id_idx" ON "execution" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "execution_status_idx" ON "execution" USING btree ("status");