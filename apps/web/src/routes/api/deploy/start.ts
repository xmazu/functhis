import { handleDeployStart } from '@functhis/deploy/http';
import { createFileRoute } from '@tanstack/react-router';

import { createDeployHandlerContext } from '../../../server/deploy/context';

export const Route = createFileRoute('/api/deploy/start')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleDeployStart(request, await createDeployHandlerContext()),
    },
  },
});
