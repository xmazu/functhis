import { createAuth as createConfiguredAuth } from '@functhis/auth';
import type { AuthConfig } from '@functhis/auth';
import { ensureCliOAuthClient } from '@functhis/auth/seed-cli-client';
import { createDb, resolveSecret } from '@functhis/db';
import type { Database } from '@functhis/db';
import {
  asHotKvBinding,
  listMembershipOrganizationIds,
  writeJwksHot,
  writeMembershipHot,
} from '@functhis/publish';

import { env } from './env.server';

type AuthInstance = ReturnType<typeof createConfiguredAuth>;

type EnvSecret = (typeof env)[keyof typeof env];

const resolveNamedSecret = async (
  name: string,
  value: EnvSecret
): Promise<string> => {
  if (value === undefined) {
    throw new Error(
      `Missing ${name}. Set it in apps/web/.env (see README.md — GitHub OAuth app).`
    );
  }
  return await resolveSecret(value as string | { get: () => Promise<string> });
};

const parseTrustedOrigins = (value: string): string[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const getDb = (): Promise<Database> => createDb(env);

let cliClientSeeded = false;
let cliSeedPromise: Promise<void> | null = null;
let authConfigPromise: Promise<AuthConfig> | null = null;

const warmJwksHot = async (): Promise<void> => {
  const hot = asHotKvBinding(env.HOT);
  try {
    const jwksResponse = await fetch(
      new URL('/api/auth/jwks', env.BETTER_AUTH_URL)
    );
    if (jwksResponse.ok) {
      await writeJwksHot(hot, await jwksResponse.json());
    }
  } catch {
    // JWKS snapshot is best-effort; MCP can still fetch on miss
  }
};

const ensureCliClientSeeded = (): Promise<void> => {
  if (cliClientSeeded) {
    return Promise.resolve();
  }

  cliSeedPromise ??= (async () => {
    const db = await getDb();
    await ensureCliOAuthClient(db, env.MCP_RESOURCE);
    cliClientSeeded = true;
    // Must not await: jwks hits this worker and createAuth waits on seeding.
    void warmJwksHot();
  })();

  return cliSeedPromise;
};

const resolveAuthConfig = (): Promise<AuthConfig> => {
  authConfigPromise ??= (async () => {
    const [betterAuthSecret, githubClientId, githubClientSecret] =
      await Promise.all([
        resolveNamedSecret('BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET),
        resolveNamedSecret('GITHUB_CLIENT_ID', env.GITHUB_CLIENT_ID),
        resolveNamedSecret('GITHUB_CLIENT_SECRET', env.GITHUB_CLIENT_SECRET),
      ]);

    return {
      BETTER_AUTH_SECRET: betterAuthSecret,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: githubClientId,
      GITHUB_CLIENT_SECRET: githubClientSecret,
      MCP_RESOURCE: env.MCP_RESOURCE,
      TRUSTED_ORIGINS: parseTrustedOrigins(env.TRUSTED_ORIGINS),
      syncMembershipHot: async (userId) => {
        const db = await getDb();
        const organizationIds = await listMembershipOrganizationIds(db, userId);
        await writeMembershipHot(
          asHotKvBinding(env.HOT),
          userId,
          organizationIds
        );
      },
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
