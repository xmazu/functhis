import { afterAll, beforeAll } from 'bun:test';

import { cleanupIntegrationUsers } from './cleanup';
import { closeIntegrationDb } from './db';

beforeAll(async () => {
  await cleanupIntegrationUsers();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeIntegrationDb();
});
