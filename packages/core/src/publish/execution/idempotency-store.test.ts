import { describe, expect, test } from 'bun:test';

import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  decideIdempotency,
  loadIdempotencyRecord,
} from './idempotency-store';

const createDatabase = (row?: Record<string, unknown>) => {
  const calls: string[] = [];
  const database = {
    insert: () => {
      calls.push('insert');
      return {
        values: () => ({
          onConflictDoUpdate: async () => {
            await Promise.resolve();
          },
        }),
      };
    },
    select: () => {
      calls.push('select');
      return {
        from: () => ({
          where: () => ({
            limit: async () => {
              await Promise.resolve();
              return row ? [row] : [];
            },
          }),
        }),
      };
    },
    update: () => {
      calls.push('update');
      return {
        set: () => ({
          where: async () => {
            await Promise.resolve();
          },
        }),
      };
    },
  };
  return { calls, database };
};

describe('idempotency-store', () => {
  test('loads an absent record as null', async () => {
    const { calls, database } = createDatabase();
    await expect(
      loadIdempotencyRecord(database as never, 'org', 'key')
    ).resolves.toBeNull();
    expect(calls).toEqual(['select']);
  });

  test('maps a stored record and nullable response', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    const { database } = createDatabase({
      bodyText: null,
      requestHash: 'hash',
      responseStatus: null,
      status: 'in_progress',
      updatedAt,
    });
    await expect(
      loadIdempotencyRecord(database as never, 'org', 'key')
    ).resolves.toEqual({
      requestHash: 'hash',
      status: 'in_progress',
      storedResponse: null,
      updatedAtMs: updatedAt.getTime(),
    });
  });

  test('maps a completed response and writes claims and completion', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    const { calls, database } = createDatabase({
      bodyText: '{"ok":true}',
      requestHash: 'hash',
      responseStatus: 200,
      status: 'completed',
      updatedAt,
    });
    await expect(
      loadIdempotencyRecord(database as never, 'org', 'key')
    ).resolves.toMatchObject({
      storedResponse: { bodyText: '{"ok":true}', status: 200 },
    });
    await claimIdempotencyKey({
      database: database as never,
      key: 'key',
      organizationId: 'org',
      requestHash: 'next',
    });
    await completeIdempotencyKey({
      bodyText: '{"ok":true}',
      database: database as never,
      key: 'key',
      organizationId: 'org',
      status: 200,
    });
    expect(calls).toEqual(['select', 'insert', 'update']);
  });

  test('delegates decision branches to the pure resolver', () => {
    expect(decideIdempotency(null, 'hash').kind).toBe('claim');
    expect(
      decideIdempotency(
        {
          requestHash: 'hash',
          status: 'completed',
          storedResponse: { bodyText: 'ok', status: 200 },
          updatedAtMs: Date.now(),
        },
        'hash'
      ).kind
    ).toBe('replay');
  });
});
