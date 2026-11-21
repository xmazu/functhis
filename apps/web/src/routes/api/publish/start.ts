import { handlePublishStart } from '@functhis/platform';
import { createFileRoute } from '@tanstack/react-router';

import { createPublishHandlerContext } from '#/routes/api/publish/-context';

export const Route = createFileRoute('/api/publish/start')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handlePublishStart(request, await createPublishHandlerContext()),
    },
  },
});
