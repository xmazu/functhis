interface CloudflareEnv {
  AI: Ai;
  ARTIFACTS: R2Bucket;
  BUNDLES: KVNamespace;
  CONSOLE_URL: string;
  HYPERDRIVE: Hyperdrive;
  INTERNAL_EXECUTE_TOKEN: string;
  MCP: Fetcher;
  NODE_ENV: string;
}

type Env = CloudflareEnv;

declare module 'cloudflare:workers' {
  export const env: Env;

  namespace Cloudflare {
    export type Env = CloudflareEnv;
  }
}
