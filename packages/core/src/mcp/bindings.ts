import type { WorkerExecuteBindings } from '../publish/execution/worker-execute';
import type { CatalogPorts } from '../publish/ports';
import type { VectorizeBinding } from '../publish/search/vectorize-index';
import type { VectorizeUpsertEnv } from '../publish/search/vectorize-upsert';
import type { SecretBinding } from '../publish/secret-binding';

/** Worker bindings required by the Functhis MCP server (no Wrangler `Env` type). */
export type McpBindings = WorkerExecuteBindings & {
  catalog: CatalogPorts;
  AI?: VectorizeUpsertEnv['AI'];
  CAPABILITY_VECTOR_INDEX?: VectorizeBinding;
  FUNCTHIS_SECRETS_KEY: SecretBinding;
  HOT: {
    delete: (key: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    put: (
      key: string,
      value: string,
      options?: { expirationTtl?: number }
    ) => Promise<void>;
  };
  OPENROUTER_API_KEY?: SecretBinding;
  SENTRY_ENVIRONMENT?: string;
  WRANGLER_IS_LOCAL_DEV?: string;
};
