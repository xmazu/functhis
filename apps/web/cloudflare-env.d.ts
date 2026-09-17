interface CloudflareEnv {
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HYPERDRIVE: Hyperdrive;
  INTERNAL_EXECUTE_TOKEN: string;
  MCP: Fetcher;
  NODE_ENV: string;
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
