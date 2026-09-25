import { describe, expect, test } from 'bun:test';

import type { SearchCandidateRow } from './search-ranking';
import { RERANK_POOL_MAX } from './search-ranking';
import { applyAiRerankToSorted } from './search-rerank';

const row = (slug: string, lexicalScore: number): SearchCandidateRow => ({
  contract: {},
  exactMatch: false,
  functionSlug: slug,
  handle: 'alice',
  id: `@alice/tools/${slug}`,
  lexicalScore,
  packageSlug: 'tools',
  searchText: slug,
});

describe('applyAiRerankToSorted', () => {
  test('reorders head when scorer returns higher relevance', async () => {
    const sorted = [row('a', 0.9), row('b', 0.88), row('c', 0.5)];
    const result = await applyAiRerankToSorted('export pdf', sorted, () =>
      Promise.resolve(
        new Map([
          ['@alice/tools/a', 1],
          ['@alice/tools/b', 3],
          ['@alice/tools/c', 0],
        ])
      )
    );
    expect(result.map((candidate) => candidate.functionSlug)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  test('keeps stage-1 order when scorer returns null', async () => {
    const sorted = [row('a', 0.9), row('b', 0.88)];
    const result = await applyAiRerankToSorted('export pdf', sorted, () =>
      Promise.resolve(null)
    );
    expect(result.map((candidate) => candidate.functionSlug)).toEqual([
      'a',
      'b',
    ]);
  });

  test('only reranks the top pool and preserves tail order', async () => {
    const sorted = Array.from({ length: RERANK_POOL_MAX + 3 }, (_, index) =>
      row(`fn-${index}`, 1 - index * 0.001)
    );
    const result = await applyAiRerankToSorted(
      'export pdf',
      sorted,
      (_query, cards) => {
        const scores = new Map<string, number>();
        for (const card of cards) {
          scores.set(card.id, card.functionSlug === 'fn-1' ? 5 : 0);
        }
        return Promise.resolve(scores);
      }
    );
    expect(result[0]?.functionSlug).toBe('fn-1');
    expect(
      result.slice(RERANK_POOL_MAX).map((candidate) => candidate.functionSlug)
    ).toEqual(['fn-20', 'fn-21', 'fn-22']);
  });
});
