import { createMiddleware } from '@tanstack/react-start';

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    if (!request?.headers) {
      return next({ context: { session: null } });
    }

    const { createAuth } = await import('../services');
    const auth = await createAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return next({
      context: { session },
    });
  }
);
