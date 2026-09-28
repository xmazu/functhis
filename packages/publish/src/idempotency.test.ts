import { describe, expect, test } from 'bun:test';

import { EXECUTE_CPU_MS } from './constants';
import {
  createIdempotencyRequestHash,
  resolveIdempotency,
} from './idempotency';

describe('idempotency', () => {
  test('hashes id and arguments', async () => {
    const left = await createIdempotencyRequestHash({
      arguments: { email: 'a@b.c' },
      id: '@acme/crm/users/search',
    });
    const right = await createIdempotencyRequestHash({
      arguments: { email: 'a@b.c' },
      id: '@acme/crm/users/search',
    });
    const other = await createIdempotencyRequestHash({
      arguments: { email: 'other' },
      id: '@acme/crm/users/search',
    });
    expect(left).toBe(right);
    expect(left).not.toBe(other);
  });

  test('replays completed calls and rejects mismatched keys', () => {
    expect(
      resolveIdempotency(
        {
          requestHash: 'abc',
          status: 'completed',
          storedResponse: { bodyText: '{"ok":true}', status: 200 },
          updatedAtMs: Date.now(),
        },
        'abc'
      )
    ).toEqual({
      kind: 'replay',
      response: { bodyText: '{"ok":true}', replayed: true, status: 200 },
    });
    expect(
      resolveIdempotency(
        {
          requestHash: 'abc',
          status: 'completed',
          storedResponse: { bodyText: '{"ok":true}', status: 200 },
          updatedAtMs: Date.now(),
        },
        'other'
      )
    ).toEqual({ kind: 'mismatch' });
  });

  test('reclaims stale in-progress rows', () => {
    const now = Date.now();
    expect(
      resolveIdempotency(
        {
          requestHash: 'abc',
          status: 'in_progress',
          storedResponse: null,
          updatedAtMs: now,
        },
        'abc',
        now
      )
    ).toEqual({ kind: 'in_progress' });
    expect(
      resolveIdempotency(
        {
          requestHash: 'abc',
          status: 'in_progress',
          storedResponse: null,
          updatedAtMs: now - EXECUTE_CPU_MS - 6000,
        },
        'abc',
        now
      )
    ).toEqual({ kind: 'claim' });
  });
});
