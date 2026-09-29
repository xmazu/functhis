import { describe, expect, test } from 'bun:test';

import { CLEAR_WINNER_FUSED_RATIO, shouldRerankSearch } from './search-ranking';
import type { SearchCandidateRow } from './search-ranking';

const baseRow = (
  overrides: Partial<SearchCandidateRow> &
    Pick<SearchCandidateRow, 'functionSlug'>
): SearchCandidateRow => ({
  contract: { description: overrides.functionSlug },
  exactMatch: false,
  functionSlug: overrides.functionSlug,
  fusedScore: 0.02,
  handle: 'alice',
  id: `@alice/tools/${overrides.functionSlug}`,
  packageSlug: 'tools',
  rerankSummary: overrides.functionSlug,
  ...overrides,
});

describe('shouldRerankSearch', () => {
  test('skips when top hit is an exact match', () => {
    expect(
      shouldRerankSearch([
        baseRow({ exactMatch: true, functionSlug: 'hello' }),
        baseRow({ functionSlug: 'other' }),
      ])
    ).toEqual({
      reason: 'skipped-exact-match',
      rerank: false,
    });
  });

  test('skips when pool has fewer than two candidates', () => {
    expect(shouldRerankSearch([baseRow({ functionSlug: 'only' })])).toEqual({
      reason: 'skipped-small-pool',
      rerank: false,
    });
  });

  test('skips when fused scores show a clear winner', () => {
    expect(
      shouldRerankSearch([
        baseRow({ functionSlug: 'a', fusedScore: 1 }),
        baseRow({
          functionSlug: 'b',
          fusedScore: 1 * CLEAR_WINNER_FUSED_RATIO - 0.01,
        }),
      ])
    ).toEqual({
      reason: 'skipped-clear-winner',
      rerank: false,
    });
  });

  test('reranks when top scores are close and not exact', () => {
    expect(
      shouldRerankSearch([
        baseRow({ functionSlug: 'a', fusedScore: 0.03 }),
        baseRow({ functionSlug: 'b', fusedScore: 0.029 }),
      ])
    ).toEqual({
      reason: 'rerank',
      rerank: true,
    });
  });
});
