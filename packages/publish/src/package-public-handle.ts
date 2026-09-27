import type { Database } from '@functhis/db';

import { resolveOrganizationSlugById } from './org-membership-read';

/** Public `@handle` segment for MCP ids and URLs; always the owning organization slug. */
export const resolvePackagePublicHandle = (
  database: Database,
  organizationId: string | null
): Promise<string | null> => {
  if (!organizationId) {
    return Promise.resolve(null);
  }
  return resolveOrganizationSlugById(database, organizationId);
};
