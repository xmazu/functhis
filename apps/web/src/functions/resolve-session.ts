import { createIsomorphicFn } from '@tanstack/react-start';

import { getUser } from './get-user';
import { resolveServerSession } from './resolve-session.server';

/** Session lookup for route guards - direct on SSR, RPC from the browser. */
export const resolveSession = createIsomorphicFn()
  .server(() => resolveServerSession())
  .client(() => getUser());
