import type { Database } from '@functhis/db';
import { subscription } from '@functhis/db/schema/auth';
import { pkg } from '@functhis/db/schema/catalog';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import type { PackageVisibility } from './catalog-access';
import { normalizePlanId, planLimits } from './plan-catalog';
import type { FuncthisPlanLimits } from './plan-catalog';

type EntitlementsDb = Pick<Database, 'select'>;

export type OrgPlanId =
  | 'trial'
  | 'developer'
  | 'team'
  | 'enterprise'
  | 'free'
  | 'pro';

export type OrgPlanLimits = FuncthisPlanLimits;

export const TRIAL_ORG_LIMITS = planLimits('trial');
export const DEVELOPER_ORG_LIMITS = planLimits('developer');
export const TEAM_ORG_LIMITS = planLimits('team');
export const ENTERPRISE_ORG_LIMITS = planLimits('enterprise');

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

const normalizePlan = (plan: string): OrgPlanId => {
  if (plan === 'pro') {
    return 'developer';
  }
  if (plan === 'developer' || plan === 'team' || plan === 'enterprise') {
    return plan;
  }
  return 'trial';
};

export const limitsForPlan = (plan: OrgPlanId): OrgPlanLimits =>
  planLimits(normalizePlanId(plan));

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
    ACTIVE_SUBSCRIPTION_STATUSES.includes(
      row.status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]
    )
  ) {
    return row.plan === 'pro' ? 'developer' : normalizePlan(row.plan);
  }

  return 'trial';
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
  if (limits.maxPackages !== null && packageCount >= limits.maxPackages) {
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
