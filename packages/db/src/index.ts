import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import type { DatabaseConfig } from './config';
import * as authSchema from './schema/auth';
import * as catalogSchema from './schema/catalog';

const schema = { ...authSchema, ...catalogSchema };

const connectDatabase = async (connectionString: string) => {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  return drizzle(client, { schema });
};

export type Database = Awaited<ReturnType<typeof connectDatabase>>;

export { type DatabaseConfig } from './config';
export { resolveSecret, type SecretBinding } from './resolve-secret';

/** New pool client per call - required for Workers + Hyperdrive (do not cache across requests). */
export const createDb = (env: DatabaseConfig) =>
  connectDatabase(env.HYPERDRIVE.connectionString);
