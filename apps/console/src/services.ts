import {
  createAuth as createConfiguredAuth,
  ensureCliOAuthClient,
} from '@functhis/auth';
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
let authInstance: AuthInstance | null = null;
let authInitPromise: Promise<AuthInstance> | null = null;

const initAuth = async (database?: Database): Promise<AuthInstance> => {
  const db = database ?? (await getDb());
  if (!cliClientSeeded) {
    await ensureCliOAuthClient(db);
    cliClientSeeded = true;
  }

  const [betterAuthSecret, githubClientId, githubClientSecret] =
    await Promise.all([
      resolveSecret(env.BETTER_AUTH_SECRET),
      resolveSecret(env.GITHUB_CLIENT_ID),
      resolveSecret(env.GITHUB_CLIENT_SECRET),
    ]);

  return createConfiguredAuth(
    {
      BETTER_AUTH_SECRET: betterAuthSecret,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: githubClientId,
      GITHUB_CLIENT_SECRET: githubClientSecret,
      TRUSTED_ORIGINS: parseTrustedOrigins(env.TRUSTED_ORIGINS),
    },
    db
  );
};

export const createAuth = (database?: Database): Promise<AuthInstance> => {
  if (database) {
    return initAuth(database);
  }
  if (authInstance) {
    return Promise.resolve(authInstance);
  }
  authInitPromise ??= (async () => {
    const auth = await initAuth();
    authInstance = auth;
    return auth;
  })();
  return authInitPromise;
};
