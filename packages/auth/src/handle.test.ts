import { describe, expect, test } from 'bun:test';

import {
  allocateUniqueHandle,
  isValidHandle,
  normalizeHandleCandidate,
  userHandleExists,
} from './handle';

describe('normalizeHandleCandidate', () => {
  test('lowercases and strips @ prefix', () => {
    expect(normalizeHandleCandidate('@Xmazu')).toBe('xmazu');
  });

  test('replaces invalid characters with hyphens', () => {
    expect(normalizeHandleCandidate('hello world!')).toBe('hello-world');
  });

  test('collapses repeated hyphens', () => {
    expect(normalizeHandleCandidate('a---b')).toBe('a-b');
  });

  test('falls back when empty after sanitization', () => {
    expect(normalizeHandleCandidate('@@@')).toBe('user');
  });

  test('truncates to GitHub-style max length', () => {
    const long = 'a'.repeat(50);
    expect(normalizeHandleCandidate(long).length).toBe(39);
  });
});

describe('isValidHandle', () => {
  test('accepts simple handles', () => {
    expect(isValidHandle('xmazu')).toBe(true);
    expect(isValidHandle('user-2')).toBe(true);
  });

  test('rejects leading or trailing hyphen', () => {
    expect(isValidHandle('-xmazu')).toBe(false);
    expect(isValidHandle('xmazu-')).toBe(false);
  });
});

describe('allocateUniqueHandle', () => {
  test('returns base when unused', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    };

    const handle = await allocateUniqueHandle(database as never, 'fresh-user');
    expect(handle).toBe('fresh-user');
  });

  test('suffixes when base is taken', async () => {
    const occupied = new Set(['xmazu']);
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const handle = occupied.values().next().value;
              if (handle !== undefined && occupied.delete(handle)) {
                return Promise.resolve([{ id: '1' }]);
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
    };

    occupied.add('xmazu');
    const handle = await allocateUniqueHandle(database as never, 'xmazu');
    expect(handle).toBe('xmazu-2');
  });
});

describe('userHandleExists', () => {
  test('is true when a user row exists', async () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: '1' }]),
          }),
        }),
      }),
    };
    expect(await userHandleExists(database as never, 'neroli')).toBe(true);
  });
});
