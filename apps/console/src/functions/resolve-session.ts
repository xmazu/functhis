import { createIsomorphicFn } from '@tanstack/react-start';

import { getUser } from './get-user';

/** Session lookup for route guards - direct on SSR, RPC from the browser. */
export const resolveSession = createIsomorphicFn()
  .server(async () => {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { createAuth } = await import('@/services');
    const auth = await createAuth();
    return auth.api.getSession({
      headers: getRequest().headers,
    });
  })
  .client(() => getUser());
