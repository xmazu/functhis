import { createServerFn } from '@tanstack/react-start';
import { getStartContext } from '@tanstack/start-storage-context';

import { authMiddleware } from '#/middleware/auth';
import { createAuth } from '#/services';

export const listOrganizationsForSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return { activeOrganizationId: null, organizations: [] };
    }

    const request = getStartContext({ throwIfNotFound: false })?.request;
    const auth = await createAuth();
    const organizations = await auth.api.listOrganizations({
      headers: request?.headers ?? new Headers(),
    });

    const activeOrganizationId =
      context.session?.session.activeOrganizationId ?? null;

    return {
      activeOrganizationId,
      organizations: organizations ?? [],
    };
  });
