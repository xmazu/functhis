import type { SecretBinding } from '@functhis/db';
import type { VectorizeBinding } from '@functhis/publish/vectorize-index';
import type { VectorizeUpsertEnv } from '@functhis/publish/vectorize-upsert';
import type { WorkerExecuteBindings } from '@functhis/publish/worker-execute';

/** Worker bindings required by the Functhis MCP server (no Wrangler `Env` type). */
export type McpBindings = WorkerExecuteBindings & {
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
