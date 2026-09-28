import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { readSearchIndexDebt } from '../search/search-index-debt';
import { readCatalogGeneration } from './catalog-generation';
import { projectCapabilityAfterHotWrite } from './catalog-projection';
import { loadFederationIndex, projectFederationDocs } from './federation-hot';
import { queryFederationIndex } from './federation-index';

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
  test('enqueues vector debt without touching the catalog generation', async () => {
    const hot = memoryHot();
    await projectCapabilityAfterHotWrite({ doc: doc(), hot });
    expect(await readCatalogGeneration(hot, 'org-1')).toBe(0);
    const debt = await readSearchIndexDebt(hot, '@acme/crm/users/search');
    expect(debt?.organizationId).toBe('org-1');
  });
});

describe('projectFederationDocs', () => {
  test('bumps the generation once per batch and indexes aliases', async () => {
    const hot = memoryHot();
    await projectCapabilityAfterHotWrite({ doc: doc(), hot });
    await projectFederationDocs(hot, [doc(), doc()]);
    expect(await readCatalogGeneration(hot, 'org-1')).toBe(1);
    const loaded = await loadFederationIndex(hot, {
      kind: 'org',
      organizationId: 'org-1',
    });
    expect(loaded?.index.capabilities).toHaveLength(1);
    if (!loaded) {
      throw new Error('expected a federation index');
    }
    const hits = queryFederationIndex(loaded.index, { query: 'customer' });
    expect(
      hits.ranked.map((row) => loaded.index.capabilities[row.capIdx]?.id)
    ).toEqual(['@acme/crm/users/search']);
  });
});
