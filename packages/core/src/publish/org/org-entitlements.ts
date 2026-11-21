import type { PackageVisibility } from '../catalog/catalog-access';
import type { ExecutionQuotaPort, PackageStorePort } from '../ports';
import { normalizePlanId, planLimits } from './plan-catalog';
import type { FuncthisPlanLimits } from './plan-catalog';

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
  quota: ExecutionQuotaPort,
  organizationId: string
): Promise<OrgPlanId> => {
  const row = await quota.readActiveSubscription(organizationId);

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

export const countOrgPackages = (
  quota: ExecutionQuotaPort,
  organizationId: string
): Promise<number> => quota.countPackages(organizationId);

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
  quota: ExecutionQuotaPort,
  organizationId: string
): Promise<void> => {
  const plan = await resolveOrgPlan(quota, organizationId);
  const limits = limitsForPlan(plan);
  const packageCount = await countOrgPackages(quota, organizationId);
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
  packages: PackageStorePort,
  quota: ExecutionQuotaPort,
  values: {
    organizationId: string;
    ownerUserId: string;
    slug: string;
    visibility: PackageVisibility;
  }
) =>
  packages.insertIfUnderLimit(values, async (packageCount) => {
    const plan = await resolveOrgPlan(quota, values.organizationId);
    const limits = limitsForPlan(plan);
    if (limits.maxPackages !== null && packageCount >= limits.maxPackages) {
      throw new OrgQuotaExceededError(
        'package_limit',
        values.organizationId,
        plan,
        `Organization package limit reached (${limits.maxPackages} on ${plan})`
      );
    }
  });
