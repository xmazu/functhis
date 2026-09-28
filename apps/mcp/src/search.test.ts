import { describe, expect, test } from 'bun:test';

import { deterministicEmbedding } from '@functhis/publish/embedding';
import { projectFederationDocs } from '@functhis/publish/federation-hot';
import {
  writeHotFunctionDoc,
  writeMembershipHot,
} from '@functhis/publish/hot-catalog';
import type { HotFunctionDoc } from '@functhis/publish/hot-catalog';
import { mineIndexHotKey } from '@functhis/publish/hot-keys';
import type { HotKvBinding } from '@functhis/publish/http-context';
import { MemoryEmbeddingIndex } from '@functhis/publish/vectorize-index';

import {
  normalizeSearchDomain,
  searchFunctions,
  searchFunctionsWithContext,
} from './search';

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
  await projectFederationDocs(hot, [doc]);
};

describe('normalizeSearchDomain', () => {
  test('defaults to mine', () => {
    expect(normalizeSearchDomain()).toBe('mine');
    expect(normalizeSearchDomain('org')).toBe('org');
  });
});

describe('searchFunctionsWithContext', () => {
  test('nominates a zero-lexical row from the vector channel', async () => {
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
});

describe('searchFunctions', () => {
  test('uses the offline embedding path and forwards the result', async () => {
    const hot = memoryHot();
    const result = await searchFunctions(
      { HOT: hot } as Env,
      { callerUserId: 'user', query: 'mail' },
      undefined,
      {
        isEmbeddingOffline: () => true,
        resolveOpenRouterApiKey: async () => {
          await Promise.resolve();
        },
        searchFunctionsWithContext: async (context, input, options) => {
          expect(context.embedQuery).toBeUndefined();
          expect(await context.hot.get('missing')).toBeNull();
          expect(input.query).toBe('mail');
          expect(options?.rerankScorer).toBeDefined();
          return {
            ambiguous: false,
            reason: 'no_match',
            results: [],
            searchId: 'search',
            timing: {
              indexMs: 0,
              jevMs: 0,
              lexicalMs: 0,
              loadMs: 0,
              totalMs: 0,
              vectorMs: 0,
            },
          };
        },
      }
    );
    expect(result.searchId).toBe('search');
  });

  test('embeds when the environment is online', async () => {
    let embedded = false;
    const result = await searchFunctions(
      { CAPABILITY_VECTOR_INDEX: {}, HOT: memoryHot() } as Env,
      { callerUserId: 'user', query: 'mail' },
      undefined,
      {
        embedTexts: async (_env, texts) => {
          await Promise.resolve();
          embedded = texts[0] === 'probe';
          return [[1]];
        },
        isEmbeddingOffline: () => false,
        resolveOpenRouterApiKey: async () => {
          await Promise.resolve();
          return 'key';
        },
        searchFunctionsWithContext: async (context) => {
          await context.embedQuery?.('probe');
          return {
            ambiguous: false,
            reason: 'no_match',
            results: [],
            searchId: 'search',
            timing: {
              indexMs: 0,
              jevMs: 0,
              lexicalMs: 0,
              loadMs: 0,
              totalMs: 0,
              vectorMs: 0,
            },
          };
        },
        vectorIndexFactory: () => ({}) as never,
      }
    );
    expect(embedded).toBe(true);
    expect(result.reason).toBe('no_match');
  });
});
