import type { Database } from '@functhis/db';
import * as schema from '@functhis/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
}

export function createAuth(env: AuthConfig, database: Database) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: { enabled: true },
    plugins: [tanstackStartCookies()],
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
  });
}
