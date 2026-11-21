import { describe, expect, test } from 'bun:test';

import {
  reciprocalRankContribution,
  reciprocalRankFusion,
  SEARCH_RRF_K,
} from './search-rrf';

describe('reciprocalRankFusion', () => {
  test('sums 1/(k+rank) across lists', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(fused.get('a')).toBeCloseTo(
      1 / (SEARCH_RRF_K + 1) + 1 / (SEARCH_RRF_K + 2)
    );
    expect(fused.get('b')).toBeCloseTo(
      1 / (SEARCH_RRF_K + 2) + 1 / (SEARCH_RRF_K + 1)
    );
  });

  test('missing rank contributes nothing', () => {
    expect(reciprocalRankContribution(undefined, 1)).toBe(0);
    expect(reciprocalRankContribution(1, 1)).toBeCloseTo(
      1 / (SEARCH_RRF_K + 1)
    );
    expect(reciprocalRankContribution(1, 0.8)).toBeCloseTo(
      0.8 / (SEARCH_RRF_K + 1)
    );
  });
});
