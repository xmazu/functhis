import { handleDeployFinalize } from '@functhis/deploy/http';
import { createFileRoute } from '@tanstack/react-router';

import { createDeployHandlerContext } from '../../../server/deploy/context';

export const Route = createFileRoute('/api/deploy/finalize')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleDeployFinalize(request, await createDeployHandlerContext()),
    },
  },
});
