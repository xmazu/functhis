interface CloudflareEnv {
  AI: Ai;
  ANALYTICS: AnalyticsEngineDataset;
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HYPERDRIVE: Hyperdrive;
  INTERNAL_EXECUTE_TOKEN: string;
  LOADER: WorkerLoader;
  MCP_RESOURCE: string;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
