import {
  createAuth as createConfiguredAuth,
  ensureCliOAuthClient,
} from '@functhis/auth';
import { createDb } from '@functhis/db';
import type { Database } from '@functhis/db';

import { env } from './env.server';

const parseTrustedOrigins = (value: string): string[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const getDb = (): Promise<Database> => createDb(env);

let cliClientSeeded = false;
let authInstance: ReturnType<typeof createConfiguredAuth> | undefined;
let authInitPromise:
  | Promise<ReturnType<typeof createConfiguredAuth>>
  | undefined;

const initAuth = async (database?: Database) => {
  const db = database ?? (await getDb());
  if (!cliClientSeeded) {
    await ensureCliOAuthClient(db);
    cliClientSeeded = true;
  }

  return createConfiguredAuth(
    {
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
      TRUSTED_ORIGINS: parseTrustedOrigins(env.TRUSTED_ORIGINS),
    },
    db
  );
};

export const createAuth = async (database?: Database) => {
  if (authInstance) {
    return authInstance;
  }

  if (!authInitPromise) {
    authInitPromise = (async () => {
      const auth = await initAuth(database);
      authInstance = auth;
      return auth;
    })();
  }

  return await authInitPromise;
};
