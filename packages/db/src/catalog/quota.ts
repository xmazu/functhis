import type { ExecutionQuotaPort } from '@functhis/core/publish/ports';

import { and, count, desc, eq, inArray, sql } from '../drizzle';
import type { Database } from '../index';
import { subscription } from '../schema/auth';
import { orgUsagePeriod, pkg } from '../schema/catalog';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23505';

const bumpExecutionCount = async (
  database: Database,
  organizationId: string,
  periodKey: string,
  maxExecutions: number
): Promise<'reserved' | 'missing' | 'full'> => {
  const updated = await database
    .update(orgUsagePeriod)
    .set({
      executionCount: sql`${orgUsagePeriod.executionCount} + 1`,
    })
    .where(
      and(
        eq(orgUsagePeriod.organizationId, organizationId),
        eq(orgUsagePeriod.periodKey, periodKey),
        sql`${orgUsagePeriod.executionCount} < ${maxExecutions}`
      )
    )
    .returning({ executionCount: orgUsagePeriod.executionCount });

  if (updated.length > 0) {
    return 'reserved';
  }

  const [row] = await database
    .select({ executionCount: orgUsagePeriod.executionCount })
    .from(orgUsagePeriod)
    .where(
      and(
        eq(orgUsagePeriod.organizationId, organizationId),
        eq(orgUsagePeriod.periodKey, periodKey)
      )
    )
    .limit(1);

  const current = row?.executionCount ?? 0;
  if (current >= maxExecutions) {
    return 'full';
  }

  return current === 0 ? 'missing' : 'full';
};

export const createExecutionQuotaPort = (
  database: Database
): ExecutionQuotaPort => ({
  async countPackages(organizationId) {
    const [row] = await database
      .select({ value: count() })
      .from(pkg)
      .where(eq(pkg.organizationId, organizationId));

    return row?.value ?? 0;
  },

  async readActiveSubscription(organizationId) {
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
      !row ||
      !ACTIVE_SUBSCRIPTION_STATUSES.includes(
        row.status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]
      )
    ) {
      return null;
    }

    return { plan: row.plan, status: row.status };
  },

  async readExecutionCount(organizationId, periodKey) {
    const [row] = await database
      .select({ executionCount: orgUsagePeriod.executionCount })
      .from(orgUsagePeriod)
      .where(
        and(
          eq(orgUsagePeriod.organizationId, organizationId),
          eq(orgUsagePeriod.periodKey, periodKey)
        )
      )
      .limit(1);

    return row?.executionCount ?? 0;
  },

  async tryReserve(organizationId, periodKey, maxExecutions) {
    const firstAttempt = await bumpExecutionCount(
      database,
      organizationId,
      periodKey,
      maxExecutions
    );
    if (firstAttempt === 'reserved') {
      return 'reserved';
    }
    if (firstAttempt === 'full') {
      return 'full';
    }

    try {
      await database.insert(orgUsagePeriod).values({
        executionCount: 1,
        organizationId,
        periodKey,
      });
      return 'reserved';
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const secondAttempt = await bumpExecutionCount(
      database,
      organizationId,
      periodKey,
      maxExecutions
    );
    return secondAttempt === 'reserved' ? 'reserved' : 'full';
  },
});
