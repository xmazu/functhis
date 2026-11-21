import type { McpBindings } from '@functhis/core';
import type { HotKvBinding } from '@functhis/core/publish';
import type { CatalogPorts } from '@functhis/core/publish/ports';

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
