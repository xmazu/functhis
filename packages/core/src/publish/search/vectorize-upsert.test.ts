import { describe, expect, test } from 'bun:test';

import { MemoryEmbeddingIndex } from './vectorize-index';
import type { EmbeddingIndex } from './vectorize-index';
import {
  deleteCapabilityVectors,
  enqueueCapabilityVector,
  reconcileSearchIndexDebt,
} from './vectorize-upsert';

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

describe('vectorize upsert', () => {
  test('reconciles debt into the index', async () => {
    const hot = memoryHot();
    const index = new MemoryEmbeddingIndex();
    await enqueueCapabilityVector({
      capabilityId: '@acme/crm/users/search',
      hot,
      organizationId: 'org-1',
      projectionText: 'Find a user by email',
    });
    expect(
      await reconcileSearchIndexDebt({
        env: { SENTRY_ENVIRONMENT: 'test' },
        hot,
        index,
      })
    ).toBe(1);
    const matches = await index.query({
      limit: 5,
      namespace: 'org-1',
      vector: Array.from({ length: 384 }, () => 0.01),
    });
    expect(matches[0]?.id).toBe('@acme/crm/users/search');
  });

  test('clears fingerprints and debt when deleting vectors', async () => {
    const hot = memoryHot();
    const index = new MemoryEmbeddingIndex();
    await enqueueCapabilityVector({
      capabilityId: '@acme/crm/users/search',
      hot,
      organizationId: 'org-1',
      projectionText: 'Find a user by email',
    });
    await reconcileSearchIndexDebt({
      env: { SENTRY_ENVIRONMENT: 'test' },
      hot,
      index,
    });
    await deleteCapabilityVectors({
      hot,
      ids: ['@acme/crm/users/search'],
      index,
    });
    const matches = await index.query({
      limit: 5,
      namespace: 'org-1',
      vector: Array.from({ length: 384 }, () => 0.01),
    });
    expect(matches).toEqual([]);
  });

  test('skips re-embed when the fingerprint already matches', async () => {
    const hot = memoryHot();
    const index = new MemoryEmbeddingIndex();
    const input = {
      capabilityId: '@acme/crm/users/search',
      hot,
      organizationId: 'org-1',
      projectionText: 'Find a user by email',
    };
    await enqueueCapabilityVector(input);
    expect(
      await reconcileSearchIndexDebt({
        env: { SENTRY_ENVIRONMENT: 'test' },
        hot,
        index,
      })
    ).toBe(1);
    await enqueueCapabilityVector(input);
    expect(
      await reconcileSearchIndexDebt({
        env: { SENTRY_ENVIRONMENT: 'test' },
        hot,
        index,
      })
    ).toBe(1);
  });

  test('leaves debt pending when the index upsert throws', async () => {
    const hot = memoryHot();
    const index: EmbeddingIndex = {
      deleteByIds: () => Promise.resolve(),
      query: () => Promise.resolve([]),
      upsert: () => Promise.reject(new Error('vectorize unavailable')),
    };
    await enqueueCapabilityVector({
      capabilityId: '@acme/crm/users/search',
      hot,
      organizationId: 'org-1',
      projectionText: 'Find a user by email',
    });
    expect(
      await reconcileSearchIndexDebt({
        env: { SENTRY_ENVIRONMENT: 'test' },
        hot,
        index,
      })
    ).toBe(0);
  });
});
