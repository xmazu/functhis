import { describe, expect, test } from 'bun:test';

import {
  CAPABILITY_EMBEDDING_DIMENSIONS,
  cosineSimilarity,
  deterministicEmbedding,
  embedTexts,
  isEmbeddingOffline,
} from './embedding';

describe('deterministicEmbedding', () => {
  test('returns a unit vector of the pinned size', () => {
    const vec = deterministicEmbedding('Find a user by email');
    expect(vec).toHaveLength(CAPABILITY_EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test('similar phrases score higher than unrelated text', () => {
    const query = deterministicEmbedding('find the client by mail');
    const userSearch = deterministicEmbedding(
      '@acme/crm/users/search\nFind a user by email'
    );
    const invoices = deterministicEmbedding(
      '@acme/billing/invoices/search\nList invoices by number'
    );
    expect(cosineSimilarity(query, userSearch)).toBeGreaterThan(
      cosineSimilarity(query, invoices)
    );
  });
});

describe('isEmbeddingOffline', () => {
  test('is offline in tests and local dev', () => {
    expect(isEmbeddingOffline({ SENTRY_ENVIRONMENT: 'test' })).toBe(true);
    expect(isEmbeddingOffline({ WRANGLER_IS_LOCAL_DEV: 'true' })).toBe(true);
    expect(isEmbeddingOffline({})).toBe(true);
  });

  test('is online when a vector index is bound in production', () => {
    expect(
      isEmbeddingOffline({
        CAPABILITY_VECTOR_INDEX: {},
        SENTRY_ENVIRONMENT: 'production',
      })
    ).toBe(false);
  });
});

describe('embedTexts', () => {
  test('uses deterministic vectors without AI', async () => {
    const rows = await embedTexts({}, ['hello']);
    expect(rows[0]).toEqual(deterministicEmbedding('hello'));
  });

  test('returns no rows for an empty batch', async () => {
    expect(await embedTexts({}, [])).toEqual([]);
  });

  test('requires an AI binding in production', async () => {
    await expect(
      embedTexts({ SENTRY_ENVIRONMENT: 'production' }, ['hello'])
    ).rejects.toThrow(/AI binding is required/u);
  });

  test('throws when Workers AI returns a row with the wrong size', async () => {
    const modelVector = Array.from(
      { length: CAPABILITY_EMBEDDING_DIMENSIONS },
      () => 0.01
    );
    await expect(
      embedTexts(
        {
          AI: {
            run: () =>
              Promise.resolve({
                data: [modelVector, [1, 2]],
              }),
          },
        },
        ['kept', 'fallback']
      )
    ).rejects.toThrow(/invalid embedding/u);
  });
});
