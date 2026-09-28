import { describe, expect, test } from 'bun:test';

import {
  recomputeOrgBoostMap,
  writeOrgBoostMap,
  readOrgBoostMap,
} from './ranking-boost-kv';

const memoryHot = () => {
  const store = new Map<string, string>();
  return {
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};

describe('ranking boost kv', () => {
  test('round-trips a computed org map', async () => {
    const hot = memoryHot();
    const now = Date.now();
    const boosts = recomputeOrgBoostMap(
      {
        '@acme/crm/users/search': [
          { atMs: now, exposures: 1, position: 1, selected: true },
        ],
      },
      now
    );
    expect(boosts['@acme/crm/users/search']).toBeGreaterThan(0);
    await writeOrgBoostMap(hot, 'org-1', boosts);
    expect(await readOrgBoostMap(hot, 'org-1')).toEqual(boosts);
  });
});
