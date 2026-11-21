import { validatePublishBearerToken } from '@functhis/auth/publish-token';
import type { PublishHandlerContext } from '@functhis/core/publish';

import { env } from '#/env.server';
import { getCatalog, getDb } from '#/services';

export const createPublishHandlerContext =
  async (): Promise<PublishHandlerContext> => {
    const db = await getDb();
    const catalog = await getCatalog();
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
      catalog,
      hot: env.HOT,
    };
  };
