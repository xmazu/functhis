import { validatePublishBearerToken } from '@functhis/auth';
import type { Database } from '@functhis/db';
import type { PublishHandlerContext } from '@functhis/publish/http';

import { createMemoryBundles } from './memory-kv';
import type { MemoryBundles } from './memory-kv';

const INTEGRATION_CONSOLE_URL = 'http://localhost:3001';

export const createIntegrationPublishContext = (
  db: Database,
  memoryKv: MemoryBundles = createMemoryBundles(),
  memoryArtifacts: MemoryBundles = createMemoryBundles()
): PublishHandlerContext => ({
  artifacts: memoryArtifacts.bundles,
  authenticatePublish: (request) =>
    validatePublishBearerToken(db, request, {
      consoleUrl: INTEGRATION_CONSOLE_URL,
    }),
  bundles: memoryKv.bundles,
  db,
});
