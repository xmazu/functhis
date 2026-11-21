import { listMemberOrganizations } from '@functhis/platform';
import { createServerFn } from '@tanstack/react-start';

import { authMiddleware } from '#/middleware/auth';
import { getPlatform } from '#/services';

export const userHasOrganization = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return false;
    }

    const platform = await getPlatform();
    const organizations = await listMemberOrganizations(
      platform.memberships,
      userId
    );
    return organizations.length > 0;
  });
