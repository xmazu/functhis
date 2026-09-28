import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import {
  writeHotFunctionDoc,
  writeMembershipHot,
} from '../catalog/hot-catalog';
import { mineIndexHotKey } from '../catalog/hot-keys';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { deterministicEmbedding } from './embedding';
import {
  asSearchContract,
  buildVectorRankMap,
  indexSearchShouldDeferToFallback,
  refineIndexOutcomeWithJev,
  runSearchFallback,
  withTimeout,
} from './search-fallback';
import type { SearchTiming } from './search-result';
import { MemoryEmbeddingIndex } from './vectorize-index';

const memoryHot = (): HotKvBinding => ({
  delete: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
});

const emptyTiming = (): SearchTiming => ({
  indexMs: 0,
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
});

const memoryHotStore = (): HotKvBinding & { store: Map<string, string> } => {
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

describe('asSearchContract', () => {
  test('returns null for missing or non-object contracts', () => {
    expect(asSearchContract(null)).toBeNull();
    expect(asSearchContract()).toBeNull();
    expect(asSearchContract('not-json')).toBeNull();
  });

  test('passes through object contracts', () => {
    expect(asSearchContract({ description: 'Find user' })).toEqual({
      description: 'Find user',
    });
  });
});

describe('withTimeout', () => {
  test('returns resolved work when it finishes inside the budget', async () => {
    await expect(
      withTimeout(Promise.resolve('ok'), 50, 'fallback')
    ).resolves.toBe('ok');
  });

  test('returns the fallback when work exceeds the budget', async () => {
    await expect(
      withTimeout(
        Bun.sleep(40).then(() => 'late'),
        5,
        'fallback'
      )
    ).resolves.toBe('fallback');
  });
});

describe('buildVectorRankMap', () => {
  test('returns an empty map when vector search is not configured', async () => {
    const timing = emptyTiming();
    const ranks = await buildVectorRankMap(
      { hot: memoryHot() },
      {
        docs: [],
        docsById: new Map(),
        phrasings: ['find user'],
        timing,
      }
    );
    expect(ranks.size).toBe(0);
    expect(timing.vectorMs).toBe(0);
  });

  test('clears vector ranks when embedding fails', async () => {
    const timing = emptyTiming();
    const doc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'qqq' },
      functionId: crypto.randomUUID(),
      functionSlug: 'users/search',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'find user',
      versionId: 'ver-1',
      visibility: 'private',
    };
    const id = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const ranks = await buildVectorRankMap(
      {
        embedQuery: () => Promise.reject(new Error('embed failed')),
        hot: memoryHot(),
        vectorIndex: new MemoryEmbeddingIndex(),
      },
      {
        docs: [doc],
        docsById: new Map([[id, doc]]),
        phrasings: ['find user'],
        timing,
      }
    );
    expect(ranks.size).toBe(0);
    expect(timing.vectorMs).toBeGreaterThanOrEqual(0);
  });
});

describe('runSearchFallback', () => {
  test('returns no_match when phrasings are empty', async () => {
    const outcome = await runSearchFallback(
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
      explanation: [],
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
    const outcome = await runSearchFallback(
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
    expect(outcome.explanation[0]?.exactRank).toBe(1);
  });
});

describe('indexSearchShouldDeferToFallback', () => {
  test('returns true when vector top-1 disagrees with a zero-lexical index id', async () => {
    const hot = memoryHotStore();
    const userId = 'user-defer-unit';
    const indexDoc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'qqq' },
      functionId: crypto.randomUUID(),
      functionSlug: 'users/search',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: userId,
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'qqq zzz',
      versionId: 'ver-1',
      visibility: 'private',
    };
    const vectorDoc: HotFunctionDoc = {
      ...indexDoc,
      functionId: crypto.randomUUID(),
      functionSlug: 'tickets/list',
      searchText: 'www yyy',
    };
    await writeHotFunctionDoc(hot, indexDoc);
    await writeHotFunctionDoc(hot, vectorDoc);
    await writeMembershipHot(hot, userId, ['org-1']);
    await hot.put(
      mineIndexHotKey(userId),
      JSON.stringify(['@acme/crm/users/search', '@acme/crm/tickets/list'])
    );
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/tickets/list',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find the client by mail'),
      },
    ]);
    const defer = await indexSearchShouldDeferToFallback(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      {
        callerUserId: userId,
        domain: 'mine',
        indexTopId: '@acme/crm/users/search',
        phrasings: ['find the client by mail'],
        primaryQuery: 'find the client by mail',
        timing: emptyTiming(),
      }
    );
    expect(defer).toBe(true);
  });

  test('returns false when vector search is not configured', async () => {
    const defer = await indexSearchShouldDeferToFallback(
      { hot: memoryHot() },
      {
        callerUserId: 'user-1',
        domain: 'mine',
        indexTopId: '@acme/crm/users/search',
        phrasings: ['find user'],
        primaryQuery: 'find user',
        timing: emptyTiming(),
      }
    );
    expect(defer).toBe(false);
  });

  test('returns false when vector top-1 matches the index id', async () => {
    const hot = memoryHotStore();
    const userId = 'user-defer-agree';
    const vectorDoc: HotFunctionDoc = {
      bundleHash: 'bundle',
      contract: { description: 'qqq' },
      functionId: crypto.randomUUID(),
      functionSlug: 'tickets/list',
      handle: 'acme',
      organizationId: 'org-1',
      ownerUserId: userId,
      packageId: 'pkg-1',
      packageSlug: 'crm',
      searchText: 'www yyy',
      versionId: 'ver-1',
      visibility: 'private',
    };
    await writeHotFunctionDoc(hot, vectorDoc);
    await writeMembershipHot(hot, userId, ['org-1']);
    await hot.put(
      mineIndexHotKey(userId),
      JSON.stringify(['@acme/crm/tickets/list'])
    );
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/tickets/list',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find the client by mail'),
      },
    ]);
    const defer = await indexSearchShouldDeferToFallback(
      {
        embedQuery: (text) => Promise.resolve(deterministicEmbedding(text)),
        hot,
        vectorIndex: index,
      },
      {
        callerUserId: userId,
        domain: 'mine',
        indexTopId: '@acme/crm/tickets/list',
        phrasings: ['find the client by mail'],
        primaryQuery: 'find the client by mail',
        timing: emptyTiming(),
      }
    );
    expect(defer).toBe(false);
  });
});

describe('refineIndexOutcomeWithJev', () => {
  test('returns the same outcome when rerank is not configured', async () => {
    const outcome = {
      ambiguous: false,
      explanation: [
        {
          fusedScore: 1,
          graphBonus: 0,
          id: '@acme/crm/users/search',
          usageBoost: 0,
        },
      ],
      reason: 'ok' as const,
      results: [
        {
          availability: 'ready' as const,
          contract: { description: 'Find user' },
          id: '@acme/crm/users/search',
        },
      ],
    };
    const refined = await refineIndexOutcomeWithJev(
      { hot: memoryHot() },
      undefined,
      {
        outcome,
        primaryQuery: 'find user',
        started: Date.now(),
        timing: emptyTiming(),
      }
    );
    expect(refined).toBe(outcome);
  });

  test('reorders index hits when JEV rerank runs', async () => {
    const slugs = Array.from(
      { length: 9 },
      (_, index) => `fn-${String(index)}`
    );
    const outcome = {
      ambiguous: false,
      explanation: slugs.map((slug) => ({
        fusedScore: 1,
        graphBonus: 0,
        id: `@acme/crm/${slug}`,
        usageBoost: 0,
      })),
      reason: 'ok' as const,
      results: slugs.map((slug) => ({
        availability: 'ready' as const,
        contract: { description: slug },
        id: `@acme/crm/${slug}`,
      })),
    };
    const timing = emptyTiming();
    const refined = await refineIndexOutcomeWithJev(
      { hot: memoryHot() },
      {
        remainingBudgetMs: 5000,
        rerankScorer: (_query, cards) => {
          const scores = new Map<string, number>();
          for (const [index, card] of cards.entries()) {
            scores.set(card.id, index + 1);
          }
          return Promise.resolve(scores);
        },
      },
      {
        outcome,
        primaryQuery: 'export pdf',
        started: Date.now(),
        timing,
      }
    );
    expect(refined.results[0]?.id).toBe('@acme/crm/fn-8');
    expect(refined.explanation[0]?.id).toBe('@acme/crm/fn-8');
    expect(timing.jevMs).toBeGreaterThanOrEqual(0);
  });
});
