import { createDb } from '@functhis/db';
import { listMemberOrganizations } from '@functhis/publish';
import { createServerFn } from '@tanstack/react-start';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';

export const userHasOrganization = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return false;
    }

    const database = await createDb(env);
    const organizations = await listMemberOrganizations(database, userId);
    return organizations.length > 0;
  });
