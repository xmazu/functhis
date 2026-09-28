import type { Database } from '@functhis/db';
import { orgUsagePeriod } from '@functhis/db/schema/catalog';
import { and, eq, sql } from 'drizzle-orm';

import {
  limitsForPlan,
  OrgQuotaExceededError,
  resolveOrgPlan,
} from './org-entitlements';

export const currentUsagePeriodKey = (date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const readOrgExecutionCount = async (
  database: Database,
  organizationId: string,
  periodKey = currentUsagePeriodKey()
): Promise<number> => {
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
};

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

  const current = await readOrgExecutionCount(
    database,
    organizationId,
    periodKey
  );
  if (current >= maxExecutions) {
    return 'full';
  }

  return current === 0 ? 'missing' : 'full';
};

/** Fail-closed reservation before starting compute. */
export const reserveOrgExecution = async (
  database: Database,
  organizationId: string
): Promise<void> => {
  const periodKey = currentUsagePeriodKey();
  const plan = await resolveOrgPlan(database, organizationId);
  const limits = limitsForPlan(plan);
  const maxExecutions = limits.maxExecutionsPerMonth;

  const quotaError = () =>
    new OrgQuotaExceededError(
      'execution_limit',
      organizationId,
      plan,
      `Organization execution limit reached (${maxExecutions} per month on ${plan})`
    );

  const firstAttempt = await bumpExecutionCount(
    database,
    organizationId,
    periodKey,
    maxExecutions
  );
  if (firstAttempt === 'reserved') {
    return;
  }
  if (firstAttempt === 'full') {
    throw quotaError();
  }

  try {
    await database.insert(orgUsagePeriod).values({
      executionCount: 1,
      organizationId,
      periodKey,
    });
    return;
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
  if (secondAttempt === 'reserved') {
    return;
  }

  throw quotaError();
};
