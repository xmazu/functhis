import {
  ensurePostgresDatabase,
  migrateDatabaseFromUrl,
} from '@functhis/db/integration-migrate';

import {
  assertLocalDatabaseUrl,
  integrationDatabaseUrl,
} from '../src/harness/env';

export const migrateIntegrationDatabase = async (): Promise<void> => {
  const databaseUrl = integrationDatabaseUrl();
  assertLocalDatabaseUrl(databaseUrl);
  await ensurePostgresDatabase(databaseUrl);
  await migrateDatabaseFromUrl(databaseUrl);
};

if (import.meta.main) {
  await migrateIntegrationDatabase();
  console.log('Integration database migrated');
}
