import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '../../lib/auth-handler';

export const Route = createFileRoute('/oauth2/$')({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuthRequest(request),
      POST: async ({ request }) => handleAuthRequest(request),
    },
  },
});
