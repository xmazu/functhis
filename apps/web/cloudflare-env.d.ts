interface CloudflareEnv {
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HYPERDRIVE: Hyperdrive;
  NODE_ENV: string;
  RUNTIME: Fetcher;
  RUNTIME_EXECUTE_SECRET: string;
}

declare global {
  type Env = CloudflareEnv;
}

declare module 'cloudflare:workers' {
  namespace Cloudflare {
    export type Env = CloudflareEnv;
  }
}

export type { CloudflareEnv };
