import { asHotKvBinding } from '@functhis/publish/hot-kv-binding';

import { integrationDatabaseUrl } from './env';
import type { MemoryHotKv } from './memory-hot-kv';

const INTEGRATION_SECRETS_KEY = 'integration-test-secrets-key-32b!';

export const createIntegrationMcpEnv = (memoryHot: MemoryHotKv): Env =>
  ({
    CONSOLE_URL: 'http://localhost:3001',
    FUNCTHIS_SECRETS_KEY: INTEGRATION_SECRETS_KEY,
    HOT: memoryHot as KVNamespace,
    HYPERDRIVE: {
      connectionString: integrationDatabaseUrl(),
    },
    MCP_RESOURCE: 'https://mcp.functhis.now',
  }) as Env;

export const integrationHotBinding = (memoryHot: MemoryHotKv) =>
  asHotKvBinding(memoryHot);
