import { describe, expect, test } from 'bun:test';

import { deterministicEmbedding } from './embedding';
import {
  MemoryEmbeddingIndex,
  VectorizeEmbeddingIndex,
} from './vectorize-index';

describe('MemoryEmbeddingIndex', () => {
  test('returns same-namespace cosine neighbors and ignores other kinds', async () => {
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: '@acme/crm/users/search',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('Find a user by email'),
      },
      {
        id: '@acme/billing/invoices/search',
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('List invoices by number'),
      },
      {
        id: '@other/crm/users/search',
        metadata: { kind: 'hosted_function', organizationId: 'org-2' },
        namespace: 'org-2',
        values: deterministicEmbedding('Find a user by email'),
      },
    ]);
    const matches = await index.query({
      limit: 10,
      namespace: 'org-1',
      vector: deterministicEmbedding('find the client by mail'),
    });
    expect(matches[0]?.id).toBe('@acme/crm/users/search');
    expect(matches.some((row) => row.id === '@other/crm/users/search')).toBe(
      false
    );
  });

  test('deleteByIds removes vectors', async () => {
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id: 'a',
        metadata: { kind: 'hosted_function' },
        namespace: 'org',
        values: deterministicEmbedding('a'),
      },
    ]);
    await index.deleteByIds(['a']);
    const matches = await index.query({
      limit: 10,
      namespace: 'org',
      vector: deterministicEmbedding('a'),
    });
    expect(matches).toEqual([]);
  });
});

describe('VectorizeEmbeddingIndex', () => {
  test('maps binding query matches and upserts through the index', async () => {
    const deleted: string[][] = [];
    const upserted: unknown[] = [];
    const index = new VectorizeEmbeddingIndex({
      deleteByIds: (ids) => {
        deleted.push(ids);
        return Promise.resolve();
      },
      query: () =>
        Promise.resolve({
          matches: [
            { id: 'a', score: 0.9 },
            { id: 'a', score: 0.8 },
            { score: 0.1 },
            { id: 'b', score: 0.7 },
          ],
        }),
      upsert: (rows) => {
        upserted.push(rows);
        return Promise.resolve();
      },
    });
    await index.deleteByIds([]);
    await index.deleteByIds(['x']);
    expect(deleted).toEqual([['x']]);
    await index.upsert([]);
    await index.upsert([
      {
        id: 'a',
        metadata: { kind: 'hosted_function' },
        namespace: 'org',
        values: [1],
      },
    ]);
    expect(upserted).toHaveLength(1);
    const matches = await index.query({
      limit: 10,
      namespace: 'org',
      vector: [1],
    });
    expect(matches).toEqual([
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.7 },
    ]);
  });
});
