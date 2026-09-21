import { validateDeployBearerToken } from '@functhis/auth';
import type { Database } from '@functhis/db';
import type { DeployHandlerContext } from '@functhis/deploy/http';

import { createMemoryBundles } from './memory-kv';
import type { MemoryBundles } from './memory-kv';

const INTEGRATION_CONSOLE_URL = 'http://localhost:3002';

export const createIntegrationDeployContext = (
  db: Database,
  memoryKv: MemoryBundles = createMemoryBundles()
): DeployHandlerContext => ({
  authenticateDeploy: (request) =>
    validateDeployBearerToken(db, request, {
      consoleUrl: INTEGRATION_CONSOLE_URL,
    }),
  bundles: memoryKv.bundles,
  db,
});
