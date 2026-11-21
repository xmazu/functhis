import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { runCatalogSearch } from './search-catalog-pipeline';
import type { SearchTiming } from './search-result';

const memoryHot = (): HotKvBinding => ({
  delete: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
});

const emptyTiming = (): SearchTiming => ({
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
});

describe('runCatalogSearch', () => {
  test('returns no_match when phrasings are empty', async () => {
    const outcome = await runCatalogSearch(
      { hot: memoryHot() },
      {
        callerUserId: 'user-1',
        docs: [],
        docsById: new Map(),
        phrasings: [],
        primaryQuery: 'find user',
        started: Date.now(),
        timing: emptyTiming(),
      }
    );
    expect(outcome).toEqual({
      ambiguous: false,
      reason: 'no_match',
      results: [],
    });
  });

  test('prioritizes exact function slug matches', async () => {
    const doc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'Find a user' },
      functionId: crypto.randomUUID(),
      functionSlug: 'users/search',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'users/search\nFind a user by email',
      versionId: 'ver-1',
      visibility: 'private',
    };
    const id = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const outcome = await runCatalogSearch(
      { hot: memoryHot() },
      {
        callerUserId: 'user-1',
        docs: [doc],
        docsById: new Map([[id, doc]]),
        phrasings: ['users/search'],
        primaryQuery: 'users/search',
        started: Date.now(),
        timing: emptyTiming(),
      }
    );
    expect(outcome.reason).toBe('ok');
    expect(outcome.results[0]?.id).toBe(id);
  });
});
