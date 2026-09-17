interface CloudflareEnv {
  ANALYTICS: AnalyticsEngineDataset;
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HYPERDRIVE: Hyperdrive;
  LOADER: WorkerLoader;
  MCP_RESOURCE: string;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
