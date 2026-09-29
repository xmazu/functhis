import { describe, expect, test } from 'bun:test';

import { trimSearchResultToBudget, utf8ByteLength } from './search-result';
import type { SearchResult } from './search-result';

const emptyTiming = {
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
};

describe('trimSearchResultToBudget', () => {
  test('drops the tail until the payload fits', () => {
    const bulky = 'x'.repeat(300);
    const result: SearchResult = {
      ambiguous: false,
      explanation: [
        { fusedScore: 1, id: '@a/p/one' },
        { fusedScore: 0.5, id: '@a/p/two' },
      ],
      reason: 'ok',
      results: [
        { availability: 'ready', contract: { bulky }, id: '@a/p/one' },
        { availability: 'ready', contract: { bulky }, id: '@a/p/two' },
      ],
      searchId: 's1',
      timing: emptyTiming,
    };
    const trimmed = trimSearchResultToBudget(result, 900);
    expect(trimmed.results).toHaveLength(1);
    expect(utf8ByteLength(JSON.stringify(trimmed))).toBeLessThanOrEqual(900);
  });
});
