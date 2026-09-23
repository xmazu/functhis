import { organization, user } from '@functhis/db/schema/auth';
import { pkg } from '@functhis/db/schema/catalog';
import { inArray, sql } from 'drizzle-orm';

import { integrationDb } from './db';

/** POSIX regex; avoids SQL LIKE treating `_` as a single-character wildcard. */
const INTEGRATION_USER_HANDLE_PATTERN = '^int_db_';

export const cleanupIntegrationUsers = async (): Promise<void> => {
  const db = await integrationDb();
  const integrationUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.handle} ~ ${INTEGRATION_USER_HANDLE_PATTERN}`);

  const userIds = integrationUsers.map((row) => row.id);
  if (userIds.length > 0) {
    await db.delete(pkg).where(inArray(pkg.ownerUserId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
  }

  await db.delete(organization).where(sql`${organization.slug} ~ '^int-db-'`);
};
