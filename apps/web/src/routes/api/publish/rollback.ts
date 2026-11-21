import { handlePublishRollback } from '@functhis/platform';
import { createFileRoute } from '@tanstack/react-router';

import { createPublishHandlerContext } from '#/routes/api/publish/-context';

export const Route = createFileRoute('/api/publish/rollback')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handlePublishRollback(request, await createPublishHandlerContext()),
    },
  },
});
