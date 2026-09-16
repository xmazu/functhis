import { createFileRoute } from '@tanstack/react-router';

import { handleDeployFinalize } from '../../../server/deploy/handlers';

export const Route = createFileRoute('/api/deploy/finalize')({
  server: {
    handlers: {
      POST: ({ request }) => handleDeployFinalize(request),
    },
  },
});
