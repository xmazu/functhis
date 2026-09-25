import { validatePublishBearerToken } from '@functhis/auth';
import type { PublishHandlerContext } from '@functhis/publish/http';

import { env } from '../../env.server';
import { getDb } from '../../services';

export const createPublishHandlerContext =
  async (): Promise<PublishHandlerContext> => {
    const db = await getDb();
    const consoleUrl = env.BETTER_AUTH_URL;
    const ai =
      env.AI === undefined ? undefined : { run: env.AI.run.bind(env.AI) };
    return {
      ai,
      artifacts: {
        put: async (key, value) => {
          await env.ARTIFACTS.put(key, value);
        },
      },
      authenticatePublish: (request) =>
        validatePublishBearerToken(db, request, { consoleUrl }),
      bundles: env.BUNDLES,
      db,
    };
  };
