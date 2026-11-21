import { describe, expect, test } from 'bun:test';

import type { SearchCandidateRow } from './search-ranking';
import { applyAiRerankToSorted, buildRerankSummary } from './search-rerank';

const row = (id: string, score: number): SearchCandidateRow => ({
  doc: {} as never,
  functionSlug: 'fn',
  fused: { fusedScore: score, id },
  handle: 'acme',
  id,
  packageSlug: 'crm',
  rerankSummary: 'summary',
});

describe('buildRerankSummary', () => {
  test('combines description, parameters, and search text', () => {
    const summary = buildRerankSummary(
      {
        description: 'Find a user',
        inputSchema: {
          properties: { email: { type: 'string' }, userId: { type: 'string' } },
          type: 'object',
        },
      },
      'users search'
    );
    expect(summary).toContain('Find a user');
    expect(summary).toContain('Parameters: email, userId');
    expect(summary).toContain('users search');
  });

  test('caps output length', () => {
    const summary = buildRerankSummary(
      { description: 'x'.repeat(500) },
      '',
      50
    );
    expect(summary.length).toBeLessThanOrEqual(50);
  });
});

describe('applyAiRerankToSorted', () => {
  test('returns the original order when the scorer yields null', async () => {
    const sorted = [row('@a/p/one', 1), row('@a/p/two', 0.5)];
    const result = await applyAiRerankToSorted('query', sorted, () =>
      Promise.resolve(null)
    );
    expect(result.map((entry) => entry.id)).toEqual(['@a/p/one', '@a/p/two']);
  });

  test('reorders the head by scorer scores', async () => {
    const sorted = [row('@a/p/one', 1), row('@a/p/two', 0.5)];
    const result = await applyAiRerankToSorted('query', sorted, () =>
      Promise.resolve(
        new Map([
          ['@a/p/one', 1],
          ['@a/p/two', 3],
        ])
      )
    );
    expect(result[0]?.id).toBe('@a/p/two');
  });
});
