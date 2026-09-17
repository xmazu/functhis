interface CloudflareEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  HYPERDRIVE: Hyperdrive;
  MCP_RESOURCE: string;
  NODE_ENV: string;
  TRUSTED_ORIGINS: string;
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
