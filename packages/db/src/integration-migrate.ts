import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

const SAFE_DATABASE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/u;

const adminDatabaseUrl = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
};

export const ensurePostgresDatabase = async (
  databaseUrl: string
): Promise<void> => {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//u, '');
  if (!databaseName || databaseName === 'postgres') {
    return;
  }
  if (!SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error(`Unsafe database name: ${databaseName}`);
  }

  const adminClient = new Client({
    connectionString: adminDatabaseUrl(databaseUrl),
  });
  await adminClient.connect();
  try {
    const existing = await adminClient.query<{ datname: string }>(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [databaseName]
    );
    if (existing.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await adminClient.end();
  }
};

export const defaultMigrationsFolder = (): string =>
  path.join(import.meta.dirname, 'migrations');

export const migrateDatabaseFromUrl = async (
  databaseUrl: string,
  migrationsFolder = defaultMigrationsFolder()
): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const database = drizzle(client);
    await migrate(database, { migrationsFolder });
  } finally {
    await client.end();
  }
};
