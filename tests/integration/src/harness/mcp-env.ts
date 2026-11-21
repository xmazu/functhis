import type { McpBindings } from '@functhis/core/mcp';
import type { HotKvBinding, CatalogPorts } from '@functhis/core/publish';

import type { MemoryHotKv } from './memory-hot-kv';

const INTEGRATION_SECRETS_KEY = 'integration-test-secrets-key-32b!';

export const integrationHotBinding = (memoryHot: MemoryHotKv): HotKvBinding =>
  memoryHot;

export const createIntegrationMcpBindings = (
  memoryHot: MemoryHotKv,
  catalog: CatalogPorts
): McpBindings =>
  ({
    ANALYTICS: {
      writeDataPoint: () => {
        /* integration noop */
      },
    },
    BUNDLES: { get: () => Promise.resolve(null) },
    FUNCTHIS_SECRETS_KEY: INTEGRATION_SECRETS_KEY,
    HOT: memoryHot,
    LOADER: {
      get: () => ({
        getEntrypoint: () => ({
          fetch: () => Promise.resolve(new Response('{}')),
        }),
      }),
    },
    catalog,
  }) as McpBindings;
