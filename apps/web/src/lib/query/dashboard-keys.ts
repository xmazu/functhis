export const dashboardKeys = {
  executionDetail: (handle: string, packageSlug: string, executionId: string) =>
    [
      'dashboard',
      'execution-detail',
      handle,
      packageSlug,
      executionId,
    ] as const,
  orgSecrets: (organizationId: string) =>
    ['dashboard', 'org-secrets', organizationId] as const,
  orgUsage: (organizationId: string) =>
    ['dashboard', 'org-usage', organizationId] as const,
  organizations: () => ['dashboard', 'organizations'] as const,
  packageDetail: (handle: string, packageSlug: string) =>
    ['dashboard', 'package-detail', handle, packageSlug] as const,
  packageExecutions: (handle: string, packageSlug: string) =>
    ['dashboard', 'package-executions', handle, packageSlug] as const,
};
