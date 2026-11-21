import type { MembershipsPort } from '../ports';

/** Public `@handle` segment for MCP ids and URLs; always the owning organization slug. */
export const resolvePackagePublicHandle = (
  memberships: MembershipsPort,
  organizationId: string | null
): Promise<string | null> => {
  if (!organizationId) {
    return Promise.resolve(null);
  }
  return memberships.resolveOrganizationSlugById(organizationId);
};
