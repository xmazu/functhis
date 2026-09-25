-- Org-only packages, Stripe billing tables, usage counters, legacy migration

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;

CREATE TABLE IF NOT EXISTS "subscription" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan" text NOT NULL,
  "reference_id" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "status" text DEFAULT 'incomplete' NOT NULL,
  "period_start" timestamp,
  "period_end" timestamp,
  "trial_start" timestamp,
  "trial_end" timestamp,
  "cancel_at_period_end" boolean DEFAULT false,
  "cancel_at" timestamp,
  "canceled_at" timestamp,
  "ended_at" timestamp,
  "seats" integer,
  "billing_interval" text,
  "stripe_schedule_id" text
);

CREATE INDEX IF NOT EXISTS "subscription_reference_id_idx" ON "subscription" ("reference_id");

CREATE TABLE IF NOT EXISTS "org_usage_period" (
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "period_key" text NOT NULL,
  "execution_count" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_usage_period_org_period_uidx" ON "org_usage_period" ("organization_id", "period_key");

-- Legacy user-scoped packages: workspace org per owner handle (never join an unrelated org on slug collision)

INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT gen_random_uuid(), u."name", u."handle", NOW()
FROM "user" u
WHERE EXISTS (
  SELECT 1 FROM "package" p
  WHERE p."owner_user_id" = u."id" AND p."scope_kind" = 'user'
)
AND NOT EXISTS (
  SELECT 1 FROM "organization" o WHERE o."slug" = u."handle"
);

INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT gen_random_uuid(), u."name", u."handle" || '-workspace', NOW()
FROM "user" u
WHERE EXISTS (
  SELECT 1 FROM "package" p
  WHERE p."owner_user_id" = u."id" AND p."scope_kind" = 'user'
)
AND EXISTS (
  SELECT 1 FROM "organization" o WHERE o."slug" = u."handle"
)
AND NOT EXISTS (
  SELECT 1 FROM "organization" o
  INNER JOIN "member" m ON m."organization_id" = o."id"
  WHERE o."slug" = u."handle" AND m."user_id" = u."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "organization" o2 WHERE o2."slug" = u."handle" || '-workspace'
);

INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
SELECT gen_random_uuid(), o."id", u."id", 'owner', NOW()
FROM "user" u
JOIN "organization" o ON o."slug" = u."handle"
WHERE EXISTS (
  SELECT 1 FROM "package" p
  WHERE p."owner_user_id" = u."id" AND p."scope_kind" = 'user'
)
AND NOT EXISTS (
  SELECT 1 FROM "member" m
  WHERE m."organization_id" = o."id" AND m."user_id" = u."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "member" m
  WHERE m."organization_id" = o."id" AND m."user_id" <> u."id"
);

INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
SELECT gen_random_uuid(), o."id", u."id", 'owner', NOW()
FROM "user" u
JOIN "organization" o ON o."slug" = u."handle" || '-workspace'
WHERE EXISTS (
  SELECT 1 FROM "package" p
  WHERE p."owner_user_id" = u."id" AND p."scope_kind" = 'user'
)
AND NOT EXISTS (
  SELECT 1 FROM "member" m
  WHERE m."organization_id" = o."id" AND m."user_id" = u."id"
);

UPDATE "package" p
SET
  "organization_id" = m."organization_id",
  "scope_kind" = 'organization'
FROM "user" u
INNER JOIN "member" m ON m."user_id" = u."id" AND m."role" = 'owner'
INNER JOIN "organization" o ON o."id" = m."organization_id"
WHERE p."owner_user_id" = u."id"
  AND p."scope_kind" = 'user'
  AND (
    o."slug" = u."handle"
    OR o."slug" = u."handle" || '-workspace'
  );

-- Org-scoped packages were member-visible even when visibility was private
UPDATE "package"
SET "visibility" = 'organization'
WHERE "scope_kind" = 'organization'
  AND "visibility" = 'private'
  AND "organization_id" IS NOT NULL;
