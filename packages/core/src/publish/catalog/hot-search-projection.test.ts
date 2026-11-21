import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from './hot-catalog';
import { writeHotFunctionDoc } from './hot-catalog';
import { HOT_DEBT_PENDING_KEY } from './hot-keys';
import {
  projectCapabilityAfterHotWrite,
  projectHotDocsForSearch,
} from './hot-search-projection';

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
  contract: { description: 'Find user' },
  functionId: crypto.randomUUID(),
  functionSlug: 'users/search',
  handle: 'acme',
  organizationId,
  ownerUserId: 'user-1',
  packageId: 'pkg-1',
  packageSlug: 'crm',
  searchText: 'users search email',
  versionId: 'ver-1',
  visibility: 'private',
});

describe('hot search projection', () => {
  test('projectCapabilityAfterHotWrite enqueues vector debt', async () => {
    const hot = memoryHot();
    const doc = sampleDoc('org-1');
    await writeHotFunctionDoc(hot, doc);
    await projectCapabilityAfterHotWrite({ doc, hot });
    const pending = await hot.get(HOT_DEBT_PENDING_KEY);
    expect(pending).toContain('@acme/crm/users/search');
  });

  test('projectCapabilityAfterHotWrite skips docs without an organization', async () => {
    const hot = memoryHot();
    await projectCapabilityAfterHotWrite({ doc: sampleDoc(null), hot });
    expect(await hot.get(HOT_DEBT_PENDING_KEY)).toBeNull();
  });

  test('projectHotDocsForSearch enqueues vector debt', async () => {
    const hot = memoryHot();
    const doc = sampleDoc('org-1');
    await writeHotFunctionDoc(hot, doc);
    await projectHotDocsForSearch(hot, [doc]);
    expect(await hot.get(HOT_DEBT_PENDING_KEY)).toContain(
      '@acme/crm/users/search'
    );
  });
});
