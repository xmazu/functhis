import { listMemberOrganizations } from '@functhis/core/publish';
import { createServerFn } from '@tanstack/react-start';

import { authMiddleware } from '#/middleware/auth';
import { getCatalog } from '#/services';

export const userHasOrganization = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return false;
    }

    const catalog = await getCatalog();
    const organizations = await listMemberOrganizations(
      catalog.memberships,
      userId
    );
    return organizations.length > 0;
  });
