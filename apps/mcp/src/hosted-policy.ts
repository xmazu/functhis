import type { McpBindings, McpHostedPolicy } from '@functhis/core/mcp';
import type { SearchLoadPolicy } from '@functhis/core/publish';
import { asHotKvBinding } from '@functhis/core/publish';
import type { PlatformPorts } from '@functhis/platform';
import {
  buildAccessContextFromHot,
  buildAccessContextFromHotKv,
  canAccessPackage,
  getMembershipOrganizationIdsFromHot,
  limitsForPlan,
  OrgQuotaExceededError,
  reserveOrgExecution,
  resolveOrgPlan,
} from '@functhis/platform';

export const createHostedPolicy = (
  bindings: Pick<McpBindings, 'HOT'> & { platform: PlatformPorts }
): McpHostedPolicy => ({
  buildAccessContext: (hot, callerUserId) =>
    buildAccessContextFromHot(hot, bindings.platform.memberships, callerUserId),
  canAccessPackage,
  isQuotaExceeded: (error) => error instanceof OrgQuotaExceededError,
  quotaErrorMessage: (error) =>
    error instanceof Error ? error.message : 'quota exceeded',
  reserveExecution: (organizationId) =>
    reserveOrgExecution(bindings.platform.quota, organizationId),
  resolveFinalizeTelemetry: async ({ organizationId }) => {
    try {
      const plan = await resolveOrgPlan(
        bindings.platform.quota,
        organizationId
      );
      return { emitTelemetry: limitsForPlan(plan).logRetentionDays > 0 };
    } catch {
      return { emitTelemetry: false };
    }
  },
});

export const createSearchLoadPolicy = (
  bindings: Pick<McpBindings, 'HOT'> & { platform: PlatformPorts }
): SearchLoadPolicy => {
  const hot = asHotKvBinding(bindings.HOT);
  return {
    accessContext: (callerUserId) =>
      buildAccessContextFromHotKv(hot, callerUserId),
    canAccessPackage,
    organizationIds: (callerUserId) =>
      getMembershipOrganizationIdsFromHot(
        hot,
        bindings.platform.memberships,
        callerUserId
      ),
  };
};
