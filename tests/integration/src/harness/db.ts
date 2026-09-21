import type { Database } from '@functhis/db';
import { closeDb, createDbFromUrl } from '@functhis/db/node-postgres';

import { assertLocalDatabaseUrl, integrationDatabaseUrl } from './env';

let database: Database | null = null;
let databasePromise: Promise<Database> | null = null;

export const integrationDb = (): Promise<Database> => {
  if (database) {
    return Promise.resolve(database);
  }
  if (!databasePromise) {
    const url = integrationDatabaseUrl();
    assertLocalDatabaseUrl(url);
    databasePromise = (async () => {
      const db = await createDbFromUrl(url);
      database = db;
      return db;
    })();
  }
  return databasePromise;
};

export const closeIntegrationDb = async (): Promise<void> => {
  if (!database) {
    return;
  }
  await closeDb(database);
  database = null;
  databasePromise = null;
};
