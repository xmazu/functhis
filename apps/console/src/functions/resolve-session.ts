import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { createAuth } from '@/services';

import { getUser } from './get-user';

/** Session lookup for route guards — direct on SSR, RPC from the browser. */
export const resolveSession = createIsomorphicFn()
  .server(async () => {
    const auth = await createAuth();
    return auth.api.getSession({
      headers: getRequest().headers,
    });
  })
  .client(() => getUser());
