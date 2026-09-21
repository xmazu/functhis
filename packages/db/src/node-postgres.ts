import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import * as authSchema from './schema/auth';
import * as catalogSchema from './schema/catalog';

const schema = { ...authSchema, ...catalogSchema };

const pgClients = new WeakMap<object, Client>();

const connectDatabase = async (connectionString: string) => {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  const database = drizzle(client, { schema });
  pgClients.set(database, client);
  return database;
};

/** Direct Postgres URL (integration tests, scripts). Caller should `closeDb` when done. */
export const createDbFromUrl = (connectionString: string) =>
  connectDatabase(connectionString);

export type OwnedDatabase = Awaited<ReturnType<typeof createDbFromUrl>>;

/** Closes the underlying `pg` client. Integration tests and scripts only. */
export const closeDb = async (database: OwnedDatabase): Promise<void> => {
  const client = pgClients.get(database);
  if (client) {
    await client.end();
    pgClients.delete(database);
  }
};
