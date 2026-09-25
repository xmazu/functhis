import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '#/modules/auth/lib/auth-handler';

export const Route = createFileRoute('/oauth2/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
