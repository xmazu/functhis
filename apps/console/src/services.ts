import {
  createAuth as createConfiguredAuth,
  ensureCliOAuthClient,
} from '@functhis/auth';
import type { AuthConfig } from '@functhis/auth';
import { createDb, resolveSecret } from '@functhis/db';
import type { Database } from '@functhis/db';

import { env } from './env.server';

type AuthInstance = ReturnType<typeof createConfiguredAuth>;

const parseTrustedOrigins = (value: string): string[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const getDb = (): Promise<Database> => createDb(env);

let cliClientSeeded = false;
let cliSeedPromise: Promise<void> | null = null;
let authConfigPromise: Promise<AuthConfig> | null = null;

const ensureCliClientSeeded = (): Promise<void> => {
  if (cliClientSeeded) {
    return Promise.resolve();
  }

  cliSeedPromise ??= (async () => {
    const db = await getDb();
    await ensureCliOAuthClient(db, env.MCP_RESOURCE);
    cliClientSeeded = true;
  })();

  return cliSeedPromise;
};

const resolveAuthConfig = (): Promise<AuthConfig> => {
  authConfigPromise ??= (async () => {
    const [betterAuthSecret, githubClientId, githubClientSecret] =
      await Promise.all([
        resolveSecret(env.BETTER_AUTH_SECRET),
        resolveSecret(env.GITHUB_CLIENT_ID),
        resolveSecret(env.GITHUB_CLIENT_SECRET),
      ]);

    return {
      BETTER_AUTH_SECRET: betterAuthSecret,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: githubClientId,
      GITHUB_CLIENT_SECRET: githubClientSecret,
      MCP_RESOURCE: env.MCP_RESOURCE,
      TRUSTED_ORIGINS: parseTrustedOrigins(env.TRUSTED_ORIGINS),
    };
  })();

  return authConfigPromise;
};

/** Fresh Hyperdrive client per call - do not cache Better Auth across requests. */
export const createAuth = async (
  database?: Database
): Promise<AuthInstance> => {
  await ensureCliClientSeeded();
  const config = await resolveAuthConfig();
  const db = database ?? (await getDb());
  return createConfiguredAuth(config, db);
};
