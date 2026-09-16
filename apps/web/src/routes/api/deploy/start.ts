import { createFileRoute } from '@tanstack/react-router';

import { handleDeployStart } from '../../../server/deploy/handlers';

export const Route = createFileRoute('/api/deploy/start')({
  server: {
    handlers: {
      POST: ({ request }) => handleDeployStart(request),
    },
  },
});
