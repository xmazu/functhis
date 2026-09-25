import { handlePublishFinalize } from '@functhis/publish/http';
import { createFileRoute } from '@tanstack/react-router';

import { createPublishHandlerContext } from '#/routes/api/publish/-context';

export const Route = createFileRoute('/api/publish/finalize')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handlePublishFinalize(request, await createPublishHandlerContext()),
    },
  },
});
