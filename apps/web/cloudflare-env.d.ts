interface CloudflareEnv {
  ARTIFACTS: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BUNDLES: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  FUNCTHIS_SECRETS_KEY?: string;
  HOT: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  MCP_RESOURCE: string;
  NODE_ENV: string;
  TRUSTED_ORIGINS: string;
}

type Env = CloudflareEnv;

declare module 'cloudflare:workers' {
  export const env: Env;

  namespace Cloudflare {
    export type Env = CloudflareEnv;
  }
}
