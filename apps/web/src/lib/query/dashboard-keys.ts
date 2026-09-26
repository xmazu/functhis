export const dashboardKeys = {
  orgSecrets: (organizationId: string) =>
    ['dashboard', 'org-secrets', organizationId] as const,
  organizations: () => ['dashboard', 'organizations'] as const,
  packageDetail: (handle: string, packageSlug: string) =>
    ['dashboard', 'package-detail', handle, packageSlug] as const,
};
