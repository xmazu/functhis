import type { McpBindings } from '@functhis/core';
import { asHotKvBinding } from '@functhis/core/publish/hot-kv-binding';

import { integrationDatabaseUrl } from './env';
import type { MemoryHotKv } from './memory-hot-kv';

const INTEGRATION_SECRETS_KEY = 'integration-test-secrets-key-32b!';

export const createIntegrationMcpBindings = (
  memoryHot: MemoryHotKv
): McpBindings =>
  ({
    FUNCTHIS_SECRETS_KEY: INTEGRATION_SECRETS_KEY,
    HOT: memoryHot,
    HYPERDRIVE: {
      connectionString: integrationDatabaseUrl(),
    },
  }) as McpBindings;

export const integrationHotBinding = (memoryHot: MemoryHotKv) =>
  asHotKvBinding(memoryHot);
