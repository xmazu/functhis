import { describe, expect, test } from 'bun:test';

import type { IdempotencyStorePort } from '../ports';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  decideIdempotency,
  loadIdempotencyRecord,
} from './idempotency-store';

const createStore = (row?: Record<string, unknown>) => {
  const calls: string[] = [];
  const store: IdempotencyStorePort = {
    claim: () => {
      calls.push('claim');
      return Promise.resolve();
    },
    complete: () => {
      calls.push('complete');
      return Promise.resolve();
    },
    load: () => {
      calls.push('load');
      if (!row) {
        return Promise.resolve(null);
      }
      const updatedAt = row.updatedAt as Date;
      return Promise.resolve({
        requestHash: String(row.requestHash),
        status: row.status as 'completed' | 'in_progress',
        storedResponse:
          row.bodyText === null || row.responseStatus === null
            ? null
            : {
                bodyText: String(row.bodyText),
                status: Number(row.responseStatus),
              },
        updatedAtMs: updatedAt.getTime(),
      });
    },
  };
  return { calls, store };
};

describe('idempotency-store', () => {
  test('loads an absent record as null', async () => {
    const { calls, store } = createStore();
    await expect(
      loadIdempotencyRecord(store, 'org', 'key')
    ).resolves.toBeNull();
    expect(calls).toEqual(['load']);
  });

  test('maps a stored record and nullable response', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    const { store } = createStore({
      bodyText: null,
      requestHash: 'hash',
      responseStatus: null,
      status: 'in_progress',
      updatedAt,
    });
    await expect(loadIdempotencyRecord(store, 'org', 'key')).resolves.toEqual({
      requestHash: 'hash',
      status: 'in_progress',
      storedResponse: null,
      updatedAtMs: updatedAt.getTime(),
    });
  });

  test('maps a completed response and writes claims and completion', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    const { calls, store } = createStore({
      bodyText: '{"ok":true}',
      requestHash: 'hash',
      responseStatus: 200,
      status: 'completed',
      updatedAt,
    });
    await expect(
      loadIdempotencyRecord(store, 'org', 'key')
    ).resolves.toMatchObject({
      storedResponse: { bodyText: '{"ok":true}', status: 200 },
    });
    await claimIdempotencyKey({
      key: 'key',
      organizationId: 'org',
      requestHash: 'next',
      store,
    });
    await completeIdempotencyKey({
      bodyText: '{"ok":true}',
      key: 'key',
      organizationId: 'org',
      status: 200,
      store,
    });
    expect(calls).toEqual(['load', 'claim', 'complete']);
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
