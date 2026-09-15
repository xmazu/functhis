import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import type { DatabaseConfig } from './config';
import * as schema from './schema';

async function connectDatabase(connectionString: string) {
  const client = new Client({
    connectionString,
  });
  await client.connect();

  return drizzle(client, { schema });
}

export type Database = Awaited<ReturnType<typeof connectDatabase>>;

let cachedDb: { connectionString: string; db: Database } | undefined;

export async function createDb(env: DatabaseConfig) {
  const { connectionString } = env.HYPERDRIVE;
  if (cachedDb?.connectionString === connectionString) {
    return cachedDb.db;
  }

  const db = await connectDatabase(connectionString);
  cachedDb = { connectionString, db };
  return db;
}
