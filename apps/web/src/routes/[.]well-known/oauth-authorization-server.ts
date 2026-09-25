import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '#/modules/auth/lib/auth-handler';

export const Route = createFileRoute('/.well-known/oauth-authorization-server')(
  {
    server: {
      handlers: {
        GET: ({ request }) => handleAuthRequest(request),
      },
    },
  }
);
