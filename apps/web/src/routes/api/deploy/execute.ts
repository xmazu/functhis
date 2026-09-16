import { createFileRoute } from '@tanstack/react-router';

import { env } from '../../../env.server';
import { handleExecuteSmoke } from '../../../server/deploy/handlers';

export const Route = createFileRoute('/api/deploy/execute')({
  server: {
    handlers: {
      POST: ({ request }) => handleExecuteSmoke(request, env.RUNTIME),
    },
  },
});
