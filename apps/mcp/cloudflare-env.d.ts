import type { SecretBinding } from '@functhis/db';
import type { WorkerExecuteBindings } from '@functhis/publish/worker-execute';

interface CloudflareEnv extends WorkerExecuteBindings {
  AI: Ai;
  CONSOLE_URL: string;
  FUNCTHIS_SECRETS_KEY?: SecretBinding;
  HOT: KVNamespace;
  MCP_RESOURCE: string;
  OPENROUTER_API_KEY?: SecretBinding;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
