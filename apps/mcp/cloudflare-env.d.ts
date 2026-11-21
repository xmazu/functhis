import type {
  SecretBinding,
  WorkerExecuteBindings,
} from '@functhis/core/publish';

interface CloudflareEnv extends WorkerExecuteBindings {
  AI: Ai;
  CAPABILITY_VECTOR_INDEX?: Vectorize;
  CONSOLE_URL: string;
  FUNCTHIS_SECRETS_KEY: SecretBinding;
  HOT: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  MCP_RESOURCE: string;
  OPENROUTER_API_KEY?: SecretBinding;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
