import type { Database } from '@functhis/db';
import { subscription } from '@functhis/db/schema/auth';
import { pkg } from '@functhis/db/schema/catalog';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import type { PackageVisibility } from './catalog-access';

type EntitlementsDb = Pick<Database, 'select'>;

export type OrgPlanId = 'free' | 'pro';

export interface OrgPlanLimits {
  maxExecutionsPerMonth: number;
  maxPackages: number;
}

export const FREE_ORG_LIMITS: OrgPlanLimits = {
  maxExecutionsPerMonth: 1000,
  maxPackages: 3,
};

export const PRO_ORG_LIMITS: OrgPlanLimits = {
  maxExecutionsPerMonth: 100_000,
  maxPackages: 50,
};

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

export const limitsForPlan = (plan: OrgPlanId): OrgPlanLimits =>
  plan === 'pro' ? PRO_ORG_LIMITS : FREE_ORG_LIMITS;

export const resolveOrgPlan = async (
  database: EntitlementsDb,
  organizationId: string
): Promise<OrgPlanId> => {
  const [row] = await database
    .select({ plan: subscription.plan, status: subscription.status })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, organizationId),
        inArray(subscription.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
      )
    )
    .orderBy(desc(subscription.periodEnd))
    .limit(1);

  if (
    row &&
    row.plan === 'pro' &&
    ACTIVE_SUBSCRIPTION_STATUSES.includes(
      row.status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]
    )
  ) {
    return 'pro';
  }

  return 'free';
};

export const countOrgPackages = async (
  database: EntitlementsDb,
  organizationId: string
): Promise<number> => {
  const [row] = await database
    .select({ value: count() })
    .from(pkg)
    .where(eq(pkg.organizationId, organizationId));

  return row?.value ?? 0;
};

export class OrgQuotaExceededError extends Error {
  readonly code: 'package_limit' | 'execution_limit';
  readonly organizationId: string;
  readonly plan: OrgPlanId;

  constructor(
    code: 'package_limit' | 'execution_limit',
    organizationId: string,
    plan: OrgPlanId,
    message: string
  ) {
    super(message);
    this.name = 'OrgQuotaExceededError';
    this.code = code;
    this.organizationId = organizationId;
    this.plan = plan;
  }
}

export const assertOrgCanAddPackage = async (
  database: EntitlementsDb,
  organizationId: string
): Promise<void> => {
  const plan = await resolveOrgPlan(database, organizationId);
  const limits = limitsForPlan(plan);
  const packageCount = await countOrgPackages(database, organizationId);
  if (packageCount >= limits.maxPackages) {
    throw new OrgQuotaExceededError(
      'package_limit',
      organizationId,
      plan,
      `Organization package limit reached (${limits.maxPackages} on ${plan})`
    );
  }
};

export const insertOrgPackageIfUnderLimit = (
  database: Database,
  values: {
    organizationId: string;
    ownerUserId: string;
    slug: string;
    visibility: PackageVisibility;
  }
): Promise<typeof pkg.$inferSelect> =>
  database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${values.organizationId}))`
    );
    await assertOrgCanAddPackage(tx, values.organizationId);
    const [inserted] = await tx
      .insert(pkg)
      .values({
        organizationId: values.organizationId,
        ownerUserId: values.ownerUserId,
        slug: values.slug,
        visibility: values.visibility,
      })
      .returning();
    if (!inserted) {
      throw new Error('Failed to create package');
    }
    return inserted;
  });
