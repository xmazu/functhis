import { describe, expect, test } from 'bun:test';

import {
  sourceReliability,
  trimSearchResultToBudget,
  utf8ByteLength,
} from './search-result';
import type { SearchResult } from './search-result';

const emptyTiming = {
  graphMs: 0,
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
};

describe('sourceReliability', () => {
  test('downgrades degraded sources', () => {
    expect(sourceReliability('hosted_function', 'ready')).toBe(1);
    expect(sourceReliability('openapi_operation', 'ready')).toBe(0.95);
    expect(sourceReliability('remote_mcp_tool', 'ready')).toBe(0.9);
    expect(sourceReliability('hosted_function', 'degraded')).toBe(0.5);
  });
});

describe('trimSearchResultToBudget', () => {
  test('drops the tail until the payload fits', () => {
    const bulky = 'x'.repeat(800);
    const result: SearchResult = {
      ambiguous: false,
      explanation: [
        { fusedScore: 1, graphBonus: 0, id: '@a/p/one', usageBoost: 0 },
        { fusedScore: 0.5, graphBonus: 0, id: '@a/p/two', usageBoost: 0 },
      ],
      reason: 'ok',
      results: [
        { availability: 'ready', contract: { bulky }, id: '@a/p/one' },
        { availability: 'ready', contract: { bulky }, id: '@a/p/two' },
      ],
      searchId: 's1',
      timing: emptyTiming,
    };
    const trimmed = trimSearchResultToBudget(result, 2000);
    expect(trimmed.results).toHaveLength(1);
    expect(utf8ByteLength(JSON.stringify(trimmed))).toBeLessThanOrEqual(2000);
  });
});
