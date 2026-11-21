import { describe, expect, test } from 'bun:test';

import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { deterministicEmbedding } from './embedding';
import type { SearchTiming } from './search-result';
import {
  buildVectorRankMap,
  vectorNamespacesForSearchDocs,
} from './search-vector-channel';
import { MemoryEmbeddingIndex } from './vectorize-index';

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

const sampleDoc = (
  organizationId: string,
  functionSlug = 'users/search'
): HotFunctionDoc => ({
  bundleHash: 'bundle',
  contract: { description: 'qqq' },
  functionId: crypto.randomUUID(),
  functionSlug,
  handle: 'acme',
  organizationId,
  ownerUserId: 'user-1',
  packageId: 'pkg-1',
  packageSlug: 'crm',
  searchText: 'find user',
  versionId: 'ver-1',
  visibility: 'private',
});

describe('vectorNamespacesForSearchDocs', () => {
  test('caps namespaces by doc count per org', () => {
    const docs = [
      ...Array.from({ length: 5 }, (_, index) =>
        sampleDoc('org-heavy', `fn-${String(index)}`)
      ),
      sampleDoc('org-light', 'other'),
      ...Array.from({ length: 12 }, (_, index) =>
        sampleDoc(`org-${String(index)}`, `x-${String(index)}`)
      ),
    ];
    const namespaces = vectorNamespacesForSearchDocs(docs);
    expect(namespaces.length).toBeLessThanOrEqual(8);
    expect(namespaces[0]).toBe('org-heavy');
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
    const doc = sampleDoc('org-1');
    const id = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const ranks = await buildVectorRankMap(
      {
        embedQueries: () => Promise.reject(new Error('embed failed')),
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

  test('ranks accessible docs from vector matches', async () => {
    const timing = emptyTiming();
    const doc = sampleDoc('org-1');
    const id = formatFunctionId({
      functionSlug: doc.functionSlug,
      handle: doc.handle,
      packageSlug: doc.packageSlug,
    });
    const index = new MemoryEmbeddingIndex();
    await index.upsert([
      {
        id,
        metadata: { kind: 'hosted_function', organizationId: 'org-1' },
        namespace: 'org-1',
        values: deterministicEmbedding('find user'),
      },
    ]);
    const ranks = await buildVectorRankMap(
      {
        embedQueries: (texts) =>
          Promise.all(texts.map((text) => deterministicEmbedding(text))),
        hot: memoryHot(),
        vectorIndex: index,
      },
      {
        docs: [doc],
        docsById: new Map([[id, doc]]),
        phrasings: ['find user'],
        timing,
      }
    );
    expect(ranks.get(id)).toBe(1);
  });
});
