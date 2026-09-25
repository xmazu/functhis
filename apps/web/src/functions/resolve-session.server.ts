import { getStartContext } from '@tanstack/start-storage-context';

export const resolveServerSession = async () => {
  const request = getStartContext({ throwIfNotFound: false })?.request;
  if (!request?.headers) {
    return null;
  }

  const { createAuth } = await import('@/services');
  const auth = await createAuth();
  return auth.api.getSession({
    headers: request.headers,
  });
};
