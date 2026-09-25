-- Packages are always organization-scoped; drop legacy scope_kind.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "package" WHERE "organization_id" IS NULL) THEN
    RAISE EXCEPTION 'package rows without organization_id remain; fix legacy backfill before applying 0005';
  END IF;
END $$;

DROP INDEX IF EXISTS "package_user_scope_slug_uidx";
DROP INDEX IF EXISTS "package_org_scope_slug_uidx";

ALTER TABLE "package" DROP COLUMN IF EXISTS "scope_kind";

DROP TYPE IF EXISTS "public"."package_scope_kind";

ALTER TABLE "package" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "package_org_slug_uidx"
  ON "package" ("organization_id", "slug");
