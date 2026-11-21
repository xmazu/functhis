import { describe, expect, test } from 'bun:test';

import {
  clearSearchIndexDebt,
  markSearchIndexDebt,
  readSearchIndexDebt,
} from './search-index-debt';

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

describe('search index debt', () => {
  test('a newer generation cannot be cleared by a stale upsert', async () => {
    const hot = memoryHot();
    const first = await markSearchIndexDebt({
      capabilityId: '@acme/crm/users/search',
      embedText: 'v1',
      hot,
      organizationId: 'org-1',
    });
    const second = await markSearchIndexDebt({
      capabilityId: '@acme/crm/users/search',
      embedText: 'v2',
      hot,
      organizationId: 'org-1',
    });
    expect(second).toBeGreaterThan(first);
    expect(
      await clearSearchIndexDebt({
        capabilityId: '@acme/crm/users/search',
        generation: first,
        hot,
      })
    ).toBe(false);
    expect(await readSearchIndexDebt(hot, '@acme/crm/users/search')).toEqual({
      embedText: 'v2',
      generation: second,
      organizationId: 'org-1',
    });
    expect(
      await clearSearchIndexDebt({
        capabilityId: '@acme/crm/users/search',
        generation: second,
        hot,
      })
    ).toBe(true);
  });
});
