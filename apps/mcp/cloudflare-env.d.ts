interface CloudflareEnv {
  AI: Ai;
  OPENROUTER_API_KEY?: SecretsStoreSecret | string;
  ANALYTICS: AnalyticsEngineDataset;
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HOT: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  LOADER: WorkerLoader;
  MCP_RESOURCE: string;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
