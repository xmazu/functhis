import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import type { DatabaseConfig } from './config';
import * as authSchema from './schema/auth';
import * as catalogSchema from './schema/catalog';

const schema = { ...authSchema, ...catalogSchema };

const connectDatabase = async (connectionString: string) => {
  const client = new Client({
    connectionString,
  });
  await client.connect();

  return drizzle(client, { schema });
};

export type Database = Awaited<ReturnType<typeof connectDatabase>>;

let cachedDb: { connectionString: string; db: Database } | undefined;

export { resolveSecret, type SecretBinding } from './resolve-secret';

export const createDb = async (env: DatabaseConfig) => {
  const { connectionString } = env.HYPERDRIVE;
  if (cachedDb?.connectionString === connectionString) {
    return cachedDb.db;
  }

  const db = await connectDatabase(connectionString);
  cachedDb = { connectionString, db };
  return db;
};
