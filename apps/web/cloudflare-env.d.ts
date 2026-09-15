interface CloudflareEnv {
  CONSOLE_URL: string;
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
