interface CloudflareEnv {
  BUNDLES: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  LOADER: WorkerLoader;
  RUNTIME_EXECUTE_SECRET: string;
}

declare global {
  type Env = CloudflareEnv;
}

export type { CloudflareEnv };
