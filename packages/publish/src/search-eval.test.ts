import { describe, expect, test } from 'bun:test';

import {
  evaluateSearchRanking,
  meanReciprocalRank,
  ndcgAtK,
  noMatchPrecision,
  recallAtK,
} from './search-eval';

describe('search eval metrics', () => {
  test('recallAtK counts relevant ids in the head', () => {
    expect(recallAtK(['a', 'b', 'c'], ['c', 'd'], 2)).toBe(0);
    expect(recallAtK(['a', 'c', 'b'], ['c', 'd'], 2)).toBe(0.5);
    expect(recallAtK(['a'], [], 10)).toBe(1);
  });

  test('meanReciprocalRank is 1 on first-position hit', () => {
    expect(meanReciprocalRank(['a', 'b'], ['a'])).toBe(1);
    expect(meanReciprocalRank(['b', 'a'], ['a'])).toBe(0.5);
    expect(meanReciprocalRank(['b'], ['a'])).toBe(0);
    expect(meanReciprocalRank([], [])).toBe(1);
  });

  test('ndcgAtK is 1 when the relevant id is first', () => {
    expect(ndcgAtK(['a', 'b'], ['a'], 10)).toBe(1);
    expect(ndcgAtK([], [], 10)).toBe(1);
    expect(ndcgAtK(['x'], ['a'], 10)).toBe(0);
  });

  test('noMatchPrecision requires empty rankings', () => {
    expect(
      noMatchPrecision(
        [
          { ids: [], query: 'noise' },
          { ids: ['a'], query: 'keep' },
        ],
        [
          { kind: 'no-match', query: 'noise', relevant: [] },
          { kind: 'synonym', query: 'keep', relevant: ['a'] },
        ]
      )
    ).toBe(1);
    expect(
      noMatchPrecision(
        [{ ids: ['a'], query: 'noise' }],
        [{ kind: 'no-match', query: 'noise', relevant: [] }]
      )
    ).toBe(0);
  });

  test('evaluateSearchRanking averages metrics and p95', () => {
    const report = evaluateSearchRanking(
      [
        { ids: ['@acme/crm/users/search'], query: 'find user' },
        { ids: [], query: 'quantum flux' },
      ],
      [
        {
          kind: 'synonym',
          query: 'find user',
          relevant: ['@acme/crm/users/search'],
        },
        { kind: 'no-match', query: 'quantum flux', relevant: [] },
      ],
      [4, 6, 10, 12]
    );
    expect(report.recallAt10).toBe(1);
    expect(report.mrr).toBe(1);
    expect(report.ndcgAt10).toBe(1);
    expect(report.noMatchPrecision).toBe(1);
    expect(report.p95Ms).toBe(12);
  });
});
