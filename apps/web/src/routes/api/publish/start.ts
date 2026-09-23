import { handlePublishStart } from '@functhis/publish/http';
import { createFileRoute } from '@tanstack/react-router';

import { createPublishHandlerContext } from '../../../server/publish/context';

export const Route = createFileRoute('/api/publish/start')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handlePublishStart(request, await createPublishHandlerContext()),
    },
  },
});
