import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '#/modules/auth/lib/auth-handler';

export const Route = createFileRoute('/.well-known/openid-configuration')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
    },
  },
});
