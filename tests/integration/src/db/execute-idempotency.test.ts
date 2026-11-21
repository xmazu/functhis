import { describe, expect, test } from 'bun:test';

import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  decideIdempotency,
  loadIdempotencyRecord,
} from '@functhis/core/publish/idempotency-store';
import { createCatalog } from '@functhis/db/catalog';
import { organization } from '@functhis/db/schema/auth';
import { executeIdempotency } from '@functhis/db/schema/catalog';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { seedIntegrationPublishAuth } from '../harness/seed';

describe('execute idempotency persistence', () => {
  test('claims, completes, replays, and rejects a mismatched request', async () => {
    const db = await integrationDb();
    const store = createCatalog(db).idempotency;
    const suffix = crypto.randomUUID().slice(0, 8);
    const seeded = await seedIntegrationPublishAuth(db, suffix);
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, seeded.handle))
      .limit(1);
    if (!org) {
      throw new Error('Integration organization was not seeded');
    }

    const key = `key-${suffix}`;
    const requestHash = 'hash-a';
    await claimIdempotencyKey({
      key,
      organizationId: org.id,
      requestHash,
      store,
    });
    expect(await loadIdempotencyRecord(store, org.id, key)).toMatchObject({
      requestHash,
      status: 'in_progress',
      storedResponse: null,
    });

    await completeIdempotencyKey({
      bodyText: '{"ok":true}',
      key,
      organizationId: org.id,
      status: 200,
      store,
    });
    const completed = await loadIdempotencyRecord(store, org.id, key);
    expect(completed?.status).toBe('completed');
    expect(completed?.storedResponse).toEqual({
      bodyText: '{"ok":true}',
      status: 200,
    });

    const replay = decideIdempotency(completed, requestHash);
    expect(replay.kind).toBe('replay');

    const mismatch = decideIdempotency(completed, 'other-hash');
    expect(mismatch.kind).toBe('mismatch');

    const [row] = await db
      .select()
      .from(executeIdempotency)
      .where(eq(executeIdempotency.key, key))
      .limit(1);
    expect(row?.bodyText).toBe('{"ok":true}');
  });
});
