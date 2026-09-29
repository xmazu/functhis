import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import {
  hashSearchQuery,
  persistSearchSelection,
  readSearchEventHot,
  resolveSearchEventOrganizationId,
  storeSearchEventHot,
} from './search-analytics';

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

const sampleDoc = (organizationId: string | null): HotFunctionDoc => ({
  bundleHash: 'bundle',
  contract: {},
  functionId: 'fn-1',
  functionSlug: 'users/search',
  handle: 'acme',
  organizationId,
  ownerUserId: 'user-1',
  packageId: 'pkg-1',
  packageSlug: 'crm',
  searchText: 'users',
  versionId: 'ver-1',
  visibility: 'private',
});

describe('search analytics', () => {
  test('resolveSearchEventOrganizationId skips library and ambiguous multi-org', () => {
    expect(
      resolveSearchEventOrganizationId('library', [sampleDoc('org-1')], [])
    ).toBeNull();
    expect(
      resolveSearchEventOrganizationId(
        'org',
        [sampleDoc('org-1'), sampleDoc('org-2')],
        ['org-1', 'org-2']
      )
    ).toBeNull();
    expect(
      resolveSearchEventOrganizationId('org', [sampleDoc('org-1')], ['org-1'])
    ).toBe('org-1');
    expect(
      resolveSearchEventOrganizationId('mine', [sampleDoc('org-1')], [])
    ).toBe('org-1');
  });

  test('hashes queries without storing the text', async () => {
    const left = await hashSearchQuery('Find User');
    const right = await hashSearchQuery('find user');
    expect(left).toBe(right);
    expect(left).toHaveLength(64);
  });

  test('stores explanation cards in HOT without the query string', async () => {
    const hot = memoryHot();
    await storeSearchEventHot({
      callerUserId: 'user-1',
      catalogGeneration: 3,
      explanation: [
        {
          fusedScore: 0.2,
          id: '@acme/crm/users/search',
          lexicalRank: 1,
        },
      ],
      hot,
      organizationId: 'org-1',
      query: 'find the customer by email',
      searchId: 'search-1',
    });
    const stored = await readSearchEventHot(hot, 'search-1');
    expect(stored?.organizationId).toBe('org-1');
    expect(JSON.stringify(stored)).not.toContain('customer');
    expect(stored?.explanation[0]?.id).toBe('@acme/crm/users/search');
  });

  test('persists a selected result and exposure rows', async () => {
    const hot = memoryHot();
    await storeSearchEventHot({
      callerUserId: 'user-1',
      catalogGeneration: 3,
      explanation: [
        {
          fusedScore: 0.2,
          id: 'capability',
          lexicalRank: 1,
        },
      ],
      hot,
      organizationId: 'org-1',
      query: 'mail',
      searchId: 'search-2',
    });
    const values: unknown[] = [];
    const database = {
      insert: () => ({
        values: (value: unknown) => {
          values.push(value);
          return {
            onConflictDoUpdate: async () => {
              await Promise.resolve();
            },
          };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              await Promise.resolve();
              return [];
            },
          }),
        }),
      }),
    };
    await persistSearchSelection({
      capabilityId: 'capability',
      database: database as never,
      hot,
      outcome: 'succeeded',
      searchId: 'search-2',
    });
    expect(values).toHaveLength(2);
  });

  test('does nothing when the search event is missing', async () => {
    let inserted = false;
    const database = {
      insert: () => {
        inserted = true;
        return {
          values: () => ({
            onConflictDoUpdate: async () => {
              await Promise.resolve();
            },
          }),
        };
      },
    };
    await persistSearchSelection({
      capabilityId: 'missing',
      database: database as never,
      hot: memoryHot(),
      outcome: 'failed',
      searchId: 'missing',
    });
    expect(inserted).toBe(false);
  });
});
