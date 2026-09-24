import { getUser } from './get-user';

const getServerSession = async () => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { createAuth } = await import('@/services');
  const auth = await createAuth();
  return auth.api.getSession({
    headers: getRequest().headers,
  });
};

/** Session lookup for route guards - direct on SSR, RPC from the browser. */
export const resolveSession = () => {
  if (import.meta.env.SSR) {
    return getServerSession();
  }
  return getUser();
};
