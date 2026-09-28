import { describe, expect, test } from 'bun:test';

import { readCatalogGeneration } from './catalog-generation';
import { projectCapabilityAfterHotWrite } from './catalog-projection';
import { loadGraphEdgesForSeeds } from './graph-hot';
import type { HotFunctionDoc } from './hot-catalog';
import { readSearchIndexDebt } from './search-index-debt';

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

const doc = (overrides?: Partial<HotFunctionDoc>): HotFunctionDoc => ({
  bundleHash: 'bundle',
  contract: {
    description: 'Find a user by email',
    inputSchema: {
      properties: { email: { type: 'string' } },
      type: 'object',
    },
    reviewedAliases: ['customer'],
  },
  functionId: 'fn-1',
  functionSlug: 'users/search',
  handle: 'acme',
  organizationId: 'org-1',
  ownerUserId: 'user-1',
  packageId: 'pkg-1',
  packageSlug: 'crm',
  searchText: 'users/search\nFind a user by email\nemail',
  versionId: 'ver-1',
  visibility: 'private',
  ...overrides,
});

describe('projectCapabilityAfterHotWrite', () => {
  test('writes adjacency, aliases, generation, and vector debt', async () => {
    const hot = memoryHot();
    await projectCapabilityAfterHotWrite({ doc: doc(), hot });
    expect(await readCatalogGeneration(hot, 'org-1')).toBe(1);
    const aliasEdges = await loadGraphEdgesForSeeds(hot, ['alias:customer']);
    expect(aliasEdges[0]?.toId).toBe('@acme/crm/users/search');
    const debt = await readSearchIndexDebt(hot, '@acme/crm/users/search');
    expect(debt?.organizationId).toBe('org-1');
  });
});
