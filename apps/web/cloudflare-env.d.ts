interface CloudflareEnv {
  ANALYTICS_ENGINE_READ_TOKEN?: string;
  AXIOM_API_TOKEN?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE?: string;
  AXIOM_EDGE_URL?: string;
  ARTIFACTS: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BUNDLES: KVNamespace;
  CLOUDFLARE_ACCOUNT_ID?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_PRICE_DEVELOPER_MONTHLY?: string;
  STRIPE_PRICE_TEAM_MONTHLY?: string;
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
