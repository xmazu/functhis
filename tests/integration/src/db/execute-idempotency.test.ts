import { describe, expect, test } from 'bun:test';

import { organization } from '@functhis/db/schema/auth';
import { executeIdempotency } from '@functhis/db/schema/catalog';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  decideIdempotency,
  loadIdempotencyRecord,
} from '@functhis/publish/idempotency-store';
import { eq } from 'drizzle-orm';

import { integrationDb } from '../harness/db';
import { seedIntegrationPublishAuth } from '../harness/seed';

describe('execute idempotency persistence', () => {
  test('claims, completes, replays, and rejects a mismatched request', async () => {
    const db = await integrationDb();
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

    const input = {
      database: db,
      key: `key-${suffix}`,
      organizationId: org.id,
      requestHash: 'hash-a',
    };
    await claimIdempotencyKey(input);
    expect(await loadIdempotencyRecord(db, org.id, input.key)).toMatchObject({
      requestHash: 'hash-a',
      status: 'in_progress',
      storedResponse: null,
    });
    await completeIdempotencyKey({
      ...input,
      bodyText: '{"ok":true}',
      status: 200,
    });
    const completed = await loadIdempotencyRecord(db, org.id, input.key);
    expect(completed?.storedResponse).toEqual({
      bodyText: '{"ok":true}',
      status: 200,
    });
    expect(decideIdempotency(completed, 'hash-a').kind).toBe('replay');
    expect(decideIdempotency(completed, 'hash-b').kind).toBe('mismatch');

    const [row] = await db
      .select()
      .from(executeIdempotency)
      .where(eq(executeIdempotency.key, input.key))
      .limit(1);
    expect(row?.organizationId).toBe(org.id);
  });
});
