import { describe, expect, test } from 'bun:test';

import { reviewedAliasEdge } from './capability-graph';
import { loadGraphEdgesForSeeds, writeGraphAdjacency } from './graph-hot';

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

describe('graph hot adjacency', () => {
  test('writes and reads edges grouped by fromId', async () => {
    const hot = memoryHot();
    const edge = reviewedAliasEdge({
      alias: 'customer',
      capabilityId: '@acme/crm/users/search',
      generation: 1,
      organizationId: 'org-1',
    });
    await writeGraphAdjacency(hot, [edge]);
    const loaded = await loadGraphEdgesForSeeds(hot, ['alias:customer']);
    expect(loaded).toEqual([edge]);
  });
});
