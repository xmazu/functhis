import { describe, expect, test } from 'bun:test';

import {
  CLEAR_WINNER_LEXICAL_GAP,
  isExactSearchMatch,
  rankSearchCandidates,
  RERANK_SKIP_POOL_SIZE,
  shouldRerankSearch,
  sortSearchCandidates,
} from './search-ranking';
import type { SearchCandidateRow } from './search-ranking';

const baseRow = (
  overrides: Partial<SearchCandidateRow> &
    Pick<SearchCandidateRow, 'functionSlug'>
): SearchCandidateRow => ({
  contract: {},
  exactMatch: false,
  functionSlug: overrides.functionSlug,
  handle: 'alice',
  id: `@alice/tools/${overrides.functionSlug}`,
  lexicalScore: 0.5,
  packageSlug: 'tools',
  searchText: overrides.functionSlug,
  ...overrides,
});

const manyCandidates = (count: number): SearchCandidateRow[] =>
  Array.from({ length: count }, (_, index) =>
    baseRow({
      functionSlug: `fn-${index}`,
      id: `@alice/tools/fn-${index}`,
      lexicalScore: 0.5 - index * 0.01,
    })
  );

describe('search ranking', () => {
  test('sorts by lexical score then function slug', () => {
    const sorted = sortSearchCandidates([
      baseRow({ functionSlug: 'beta', lexicalScore: 0.5 }),
      baseRow({ functionSlug: 'alpha', lexicalScore: 0.5 }),
      baseRow({ functionSlug: 'gamma', lexicalScore: 0.9 }),
    ]);
    expect(sorted.map((row) => row.functionSlug)).toEqual([
      'gamma',
      'alpha',
      'beta',
    ]);
  });

  test('exact slug match ranks before higher lexical score', () => {
    const ranked = rankSearchCandidates(
      [
        baseRow({ functionSlug: 'merge', lexicalScore: 0.9 }),
        baseRow({
          exactMatch: true,
          functionSlug: 'hello',
          lexicalScore: 0.1,
        }),
      ],
      25
    );
    expect(ranked[0]?.functionSlug).toBe('hello');
  });

  test('detects exact handle, package, and function matches', () => {
    expect(
      isExactSearchMatch('hello', {
        functionSlug: 'hello',
        handle: 'alice',
        packageSlug: 'pkg',
      })
    ).toBe(true);
    expect(
      isExactSearchMatch('pkg', {
        functionSlug: 'hello',
        handle: 'alice',
        packageSlug: 'pkg',
      })
    ).toBe(true);
  });

  test('includes lexical hits', () => {
    const ranked = rankSearchCandidates(
      [baseRow({ functionSlug: 'merge', lexicalScore: 0.4 })],
      25
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.functionSlug).toBe('merge');
  });
});

describe('shouldRerankSearch', () => {
  test('skips when top hit is an exact match', () => {
    const sorted = sortSearchCandidates([
      baseRow({ exactMatch: true, functionSlug: 'hello', lexicalScore: 0.2 }),
      ...manyCandidates(10),
    ]);
    expect(shouldRerankSearch(sorted)).toEqual({
      reason: 'skipped-exact-match',
      rerank: false,
    });
  });

  test('skips when pool is at most eight', () => {
    const sorted = sortSearchCandidates(manyCandidates(RERANK_SKIP_POOL_SIZE));
    expect(shouldRerankSearch(sorted)).toEqual({
      reason: 'skipped-small-pool',
      rerank: false,
    });
  });

  test('skips when lexical gap is a clear winner', () => {
    const sorted = sortSearchCandidates([
      baseRow({ functionSlug: 'a', lexicalScore: 0.9 }),
      baseRow({
        functionSlug: 'b',
        lexicalScore: 0.9 - CLEAR_WINNER_LEXICAL_GAP,
      }),
      ...manyCandidates(8),
    ]);
    expect(shouldRerankSearch(sorted)).toEqual({
      reason: 'skipped-clear-winner',
      rerank: false,
    });
  });

  test('reranks when pool is large and top scores are close', () => {
    const sorted = sortSearchCandidates([
      baseRow({ functionSlug: 'a', lexicalScore: 0.6 }),
      baseRow({ functionSlug: 'b', lexicalScore: 0.58 }),
      ...manyCandidates(8),
    ]);
    expect(shouldRerankSearch(sorted)).toEqual({
      reason: 'rerank',
      rerank: true,
    });
  });
});
