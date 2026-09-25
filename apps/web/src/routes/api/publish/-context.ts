import { validatePublishBearerToken } from '@functhis/auth';
import type { PublishHandlerContext } from '@functhis/publish/http';

import { env } from '#/env.server';
import { getDb } from '#/services';

export const createPublishHandlerContext =
  async (): Promise<PublishHandlerContext> => {
    const db = await getDb();
    const consoleUrl = env.BETTER_AUTH_URL;
    return {
      artifacts: {
        put: async (key, value) => {
          await env.ARTIFACTS.put(key, value);
        },
      },
      authenticatePublish: (request) =>
        validatePublishBearerToken(db, request, { consoleUrl }),
      bundles: env.BUNDLES,
      db,
      hot: env.HOT,
    };
  };
