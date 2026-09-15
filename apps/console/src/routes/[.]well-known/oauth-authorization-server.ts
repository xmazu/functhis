import { createFileRoute } from '@tanstack/react-router';

import { handleAuthRequest } from '../../lib/auth-handler';

export const Route = createFileRoute('/.well-known/oauth-authorization-server')(
  {
    server: {
      handlers: {
        GET: async ({ request }) => handleAuthRequest(request),
      },
    },
  }
);
