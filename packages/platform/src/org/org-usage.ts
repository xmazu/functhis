import type { ExecutionQuotaPort } from '../ports';
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

/** Fail-closed reservation before starting compute. */
export const reserveOrgExecution = async (
  quota: ExecutionQuotaPort,
  organizationId: string
): Promise<void> => {
  const periodKey = currentUsagePeriodKey();
  const plan = await resolveOrgPlan(quota, organizationId);
  const limits = limitsForPlan(plan);
  const maxExecutions = limits.maxExecutionsPerMonth;

  const quotaError = () =>
    new OrgQuotaExceededError(
      'execution_limit',
      organizationId,
      plan,
      `Organization execution limit reached (${maxExecutions} per month on ${plan})`
    );

  const result = await quota.tryReserve(
    organizationId,
    periodKey,
    maxExecutions
  );
  if (result === 'reserved') {
    return;
  }

  throw quotaError();
};

export const readOrgExecutionCount = (
  quota: ExecutionQuotaPort,
  organizationId: string,
  periodKey = currentUsagePeriodKey()
): Promise<number> => quota.readExecutionCount(organizationId, periodKey);
