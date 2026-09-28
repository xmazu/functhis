import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import {
  writeHotFunctionDoc,
  writeMembershipHot,
} from '../catalog/hot-catalog';
import { mineIndexHotKey } from '../catalog/hot-keys';
import {
  clearFederationIndexMemo,
  projectFederationDocs,
} from '../federation/federation-hot';
import type { HotKvBinding } from '../http/http-context';
import { deterministicEmbedding } from './embedding';
import {
  normalizeSearchDomain,
  searchFunctionsWithContext,
} from './search-run';
import { MemoryEmbeddingIndex } from './vectorize-index';

const memoryHot = (): HotKvBinding & { store: Map<string, string> } => {
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
    store,
  };
};

const seedDoc = async (
  hot: HotKvBinding,
  input: {
    contract?: Record<string, unknown>;
    functionSlug: string;
    organizationId?: string;
    ownerUserId: string;
    searchText: string;
  }
): Promise<void> => {
  const doc: HotFunctionDoc = {
    bundleHash: 'bundle',
    contract: input.contract ?? { description: input.searchText },
    functionId: crypto.randomUUID(),
    functionSlug: input.functionSlug,
    handle: 'acme',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId,
    packageId: 'pkg-1',
    packageSlug: 'crm',
    searchText: input.searchText,
    versionId: 'ver-1',
    visibility: 'private',
  };
  await writeHotFunctionDoc(hot, doc);
  await writeMembershipHot(hot, input.ownerUserId, [doc.organizationId ?? '']);
  const id = `@acme/crm/${input.functionSlug}`;
  const mineKey = mineIndexHotKey(input.ownerUserId);
  const existingRaw = await hot.get(mineKey);
  const existing = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];
  await hot.put(mineKey, JSON.stringify([...existing, id]));
  clearFederationIndexMemo();
  await projectFederationDocs(hot, [doc]);
};

describe('normalizeSearchDomain', () => {
  test('defaults to mine', () => {
    expect(normalizeSearchDomain()).toBe('mine');
    expect(normalizeSearchDomain('org')).toBe('org');
  });
});

describe('searchFunctionsWithContext', () => {
  test('nominates via federation index synonym folding', async () => {
    const hot = memoryHot();
    const userId = 'user-vector';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/users/search',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find the client by mail'),
      },
    ]);
    const result = await searchFunctionsWithContext(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: 'find the client by mail' },
      { rerankScorer: () => Promise.resolve(null) }
    );
    expect(result.results[0]?.id).toBe('@acme/crm/users/search');
    expect(result.reason).toBe('ok');
  });

  test('reviewed alias nominates the aliased capability', async () => {
    const hot = memoryHot();
    const userId = 'user-alias';
    await seedDoc(hot, {
      contract: {
        description: 'Find a user by email',
        reviewedAliases: ['customer'],
      },
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'customer' }
    );
    expect(result.results[0]?.id).toBe('@acme/crm/users/search');
  });

  test('returns browse when nothing is nominated and the catalog is small', async () => {
    const hot = memoryHot();
    const userId = 'user-none';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'zzzz-unrelated-token' }
    );
    expect(result.reason).toBe('browse');
    expect(result.results.map((hit) => hit.id)).toEqual([
      '@acme/crm/users/search',
    ]);
  });

  test('returns no_match for unrelated queries when the catalog is large', async () => {
    const hot = memoryHot();
    const userId = 'user-large';
    /* eslint-disable no-await-in-loop -- mine index append in seedDoc is read-modify-write */
    for (let index = 0; index < 26; index += 1) {
      await seedDoc(hot, {
        functionSlug: `fn-${String(index)}`,
        ownerUserId: userId,
        searchText: `fn-${String(index)}\nCapability ${String(index)}`,
      });
    }
    /* eslint-enable no-await-in-loop */
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'zzzz-unrelated-token' }
    );
    expect(result.reason).toBe('no_match');
    expect(result.results).toEqual([]);
  });

  test('nominates via intents when the primary query has no lexical overlap', async () => {
    const hot = memoryHot();
    const userId = 'user-intents';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      {
        callerUserId: userId,
        intents: ['find user by email'],
        query: 'zzzz-unrelated-token',
      }
    );
    expect(result.reason).toBe('ok');
    expect(result.results[0]?.id).toBe('@acme/crm/users/search');
  });

  test('fast-path returns a single exact function id', async () => {
    const hot = memoryHot();
    const userId = 'user-exact';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: '@acme/crm/users/search' }
    );
    expect(result.results.map((hit) => hit.id)).toEqual([
      '@acme/crm/users/search',
    ]);
    expect(result.explanation[0]?.exactRank).toBe(1);
  });

  test('empty query lists owned functions', async () => {
    const hot = memoryHot();
    const userId = 'user-empty';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: '   ' }
    );
    expect(result.results[0]?.id).toBe('@acme/crm/users/search');
  });

  test('defers a synonym-only index win when vector top-1 differs', async () => {
    const hot = memoryHot();
    const userId = 'user-defer';
    await seedDoc(hot, {
      contract: {
        description: 'Find a user by email',
        inputSchema: {
          properties: { email: { type: 'string' } },
          type: 'object',
        },
      },
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'qqq zzz jjj',
    });
    const ticketDoc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'qqq zzz jjj' },
      functionId: crypto.randomUUID(),
      functionSlug: 'tickets/list',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: userId,
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'qqq zzz jjj',
      versionId: 'ver-1',
      visibility: 'private',
    };
    await writeHotFunctionDoc(hot, ticketDoc);
    const mineKey = mineIndexHotKey(userId);
    const existingRaw = await hot.get(mineKey);
    const existing = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];
    await hot.put(
      mineKey,
      JSON.stringify([...existing, '@acme/crm/tickets/list'])
    );
    clearFederationIndexMemo();
    await projectFederationDocs(hot, [ticketDoc]);
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/tickets/list',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find the client by mail'),
      },
    ]);
    const result = await searchFunctionsWithContext(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: 'find the client by mail' },
      { rerankScorer: () => Promise.resolve(null) }
    );
    expect(result.results[0]?.id).toBe('@acme/crm/tickets/list');
    expect(result.reason).toBe('ok');
  });

  test('falls back to the vector channel when no index was built', async () => {
    const hot = memoryHot();
    const userId = 'user-novindex';
    const doc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'qqq zzz jjj' },
      functionId: crypto.randomUUID(),
      functionSlug: 'users/search',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: userId,
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'qqq zzz jjj',
      versionId: 'ver-1',
      visibility: 'private',
    };
    await writeHotFunctionDoc(hot, doc);
    await writeMembershipHot(hot, userId, ['org-1']);
    await hot.put(
      mineIndexHotKey(userId),
      JSON.stringify(['@acme/crm/users/search'])
    );
    clearFederationIndexMemo();
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/users/search',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find the client by mail'),
      },
    ]);
    const result = await searchFunctionsWithContext(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      { callerUserId: userId, query: 'find the client by mail' },
      { rerankScorer: () => Promise.resolve(null) }
    );
    expect(result.results[0]?.id).toBe('@acme/crm/users/search');
    expect(result.reason).toBe('ok');
  });

  test('drops tombstoned index entries and falls back', async () => {
    const hot = memoryHot();
    const userId = 'user-tomb';
    await seedDoc(hot, {
      functionSlug: 'users/search',
      ownerUserId: userId,
      searchText: 'users/search\nFind a user by email\nemail',
    });
    await hot.put('fn:v1:@acme/crm/users/search', '{}');
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'find user by email' }
    );
    expect(
      result.results.map((hit) => hit.id).includes('@acme/crm/users/search')
    ).toBe(false);
  });

  test('falls back for callers with no memberships', async () => {
    const hot = memoryHot();
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: 'user-stranger', query: 'find user by email' }
    );
    expect(result.reason).toBe('no_match');
    expect(result.results).toEqual([]);
  });

  test('ambiguous index matches fall back to full-scan order', async () => {
    const hot = memoryHot();
    const userId = 'user-amb';
    await seedDoc(hot, {
      functionSlug: 'aaa-first',
      ownerUserId: userId,
      searchText: 'export pdf document generation',
    });
    await seedDoc(hot, {
      functionSlug: 'zzz-second',
      ownerUserId: userId,
      searchText: 'export pdf document generation',
    });
    const result = await searchFunctionsWithContext(
      { hot },
      { callerUserId: userId, query: 'export pdf' }
    );
    expect(result.results.map((hit) => hit.id)).toEqual([
      '@acme/crm/aaa-first',
      '@acme/crm/zzz-second',
    ]);
  });
});
