import { validateDeployBearerToken } from '@functhis/auth';
import type { DeployHandlerContext } from '@functhis/deploy/http';

import { env } from '../../env.server';
import { getDb } from '../../services';

export const createDeployHandlerContext =
  async (): Promise<DeployHandlerContext> => {
    const db = await getDb();
    const consoleUrl = env.CONSOLE_URL;
    const ai =
      env.AI === undefined ? undefined : { run: env.AI.run.bind(env.AI) };
    return {
      ai,
      authenticateDeploy: (request) =>
        validateDeployBearerToken(db, request, { consoleUrl }),
      bundles: env.BUNDLES,
      db,
    };
  };
