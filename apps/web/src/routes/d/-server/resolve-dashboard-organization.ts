import type { Database } from '@functhis/db';
import { isMemberOfOrganization } from '@functhis/publish';

import { createAuth } from '#/services';

interface SessionForOrgResolve {
  session: { activeOrganizationId?: string | null };
  user: { id: string };
}

/** Matches sidebar org switcher: session active org, else first listed membership. */
export const resolveDashboardOrganizationId = async (
  request: Request,
  session: SessionForOrgResolve
): Promise<string | null> => {
  const active = session.session.activeOrganizationId;
  if (active) {
    return active;
  }
  const auth = await createAuth();
  const organizations = await auth.api.listOrganizations({
    headers: request.headers,
  });
  return organizations?.[0]?.id ?? null;
};

export const requireDashboardOrganizationId = async (
  request: Request,
  database: Database,
  session: SessionForOrgResolve | null
): Promise<string | null> => {
  const userId = session?.user.id;
  if (!userId || !session) {
    return null;
  }
  const organizationId = await resolveDashboardOrganizationId(request, session);
  if (!organizationId) {
    return null;
  }
  if (!(await isMemberOfOrganization(database, userId, organizationId))) {
    return null;
  }
  return organizationId;
};
