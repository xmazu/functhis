import { validatePublishBearerToken } from '@functhis/auth/publish-token';
import type { PublishHandlerContext } from '@functhis/core/publish';
import type { Database } from '@functhis/db';
import { createCatalog } from '@functhis/db/catalog';

import { createMemoryHotKv } from './memory-hot-kv';
import { createMemoryBundles } from './memory-kv';
import type { MemoryBundles } from './memory-kv';

const INTEGRATION_CONSOLE_URL = 'http://localhost:3001';

export const createIntegrationPublishContext = (
  db: Database,
  memoryKv: MemoryBundles = createMemoryBundles(),
  memoryArtifacts: MemoryBundles = createMemoryBundles(),
  memoryHot = createMemoryHotKv()
): PublishHandlerContext => ({
  artifacts: memoryArtifacts.bundles,
  authenticatePublish: (request) =>
    validatePublishBearerToken(db, request, {
      consoleUrl: INTEGRATION_CONSOLE_URL,
    }),
  bundles: memoryKv.bundles,
  catalog: createCatalog(db),
  hot: memoryHot,
});
