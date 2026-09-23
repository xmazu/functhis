CREATE TYPE "public"."package_scope_kind" AS ENUM('user', 'organization');--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "scope_kind" "package_scope_kind" DEFAULT 'user' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "package_owner_user_id_slug_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "package_user_scope_slug_uidx" ON "package" USING btree ("owner_user_id","slug") WHERE "package"."scope_kind" = 'user';--> statement-breakpoint
CREATE UNIQUE INDEX "package_org_scope_slug_uidx" ON "package" USING btree ("organization_id","slug") WHERE "package"."scope_kind" = 'organization';--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "artifact_key" text;--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "git_dirty" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "git_sha" text;--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "runtime_version" text;--> statement-breakpoint
ALTER TABLE "package_version" ADD COLUMN "semver" text;--> statement-breakpoint
UPDATE "package_version"
SET
  "artifact_key" = 'artifacts/sha256/' || substring("bundle_hash" from 1 for 2) || '/' || "bundle_hash",
  "runtime_version" = '2025-09-15'
WHERE "artifact_key" IS NULL;--> statement-breakpoint
UPDATE "package_version" AS pv
SET "semver" = '1.0.' || (sub.n - 1)::text
FROM (
  SELECT id, row_number() OVER (PARTITION BY package_id ORDER BY created_at, id) AS n
  FROM "package_version"
) AS sub
WHERE pv.id = sub.id AND pv.semver IS NULL;--> statement-breakpoint
ALTER TABLE "package_version" ALTER COLUMN "artifact_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "package_version" ALTER COLUMN "runtime_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "package_version" ALTER COLUMN "semver" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "package_version_package_id_semver_uidx" ON "package_version" USING btree ("package_id","semver");--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_scope_handle_unique() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'user' THEN
    IF EXISTS (SELECT 1 FROM "organization" WHERE "slug" = NEW.handle) THEN
      RAISE EXCEPTION 'Handle % is already used by an organization', NEW.handle;
    END IF;
  ELSIF TG_TABLE_NAME = 'organization' THEN
    IF EXISTS (SELECT 1 FROM "user" WHERE "handle" = NEW.slug) THEN
      RAISE EXCEPTION 'Slug % is already used by a user', NEW.slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER user_handle_scope_unique
  BEFORE INSERT OR UPDATE OF handle ON "user"
  FOR EACH ROW EXECUTE FUNCTION check_scope_handle_unique();--> statement-breakpoint
CREATE TRIGGER organization_slug_scope_unique
  BEFORE INSERT OR UPDATE OF slug ON "organization"
  FOR EACH ROW EXECUTE FUNCTION check_scope_handle_unique();
