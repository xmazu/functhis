import { describe, expect, test } from 'bun:test';

import { fuseSearchCandidates, selectFusedHits } from './search-fusion';

describe('fuseSearchCandidates', () => {
  test('vector nomination reaches the shortlist with zero lexical rank', () => {
    const fused = fuseSearchCandidates([
      { id: '@acme/crm/users/search', vectorRank: 1 },
      { id: '@acme/billing/invoices/search', lexicalRank: 1 },
    ]);
    expect(
      fused.find((row) => row.id === '@acme/crm/users/search')?.nominated
    ).toBe(true);
    expect(fused.map((row) => row.id)).toContain('@acme/crm/users/search');
  });

  test('graph bonus cannot pass the no-match floor alone', () => {
    const fused = fuseSearchCandidates([
      { graphBonus: 0.12, id: '@acme/billing/invoices/search' },
    ]);
    const selected = selectFusedHits(fused);
    expect(selected.reason).toBe('no_match');
    expect(selected.selected).toEqual([]);
  });

  test('exact rank 1 skips no-match even with a tiny rrf score', () => {
    const fused = fuseSearchCandidates([
      { exactRank: 1, id: '@acme/crm/users/search' },
    ]);
    const selected = selectFusedHits(fused);
    expect(selected.reason).toBe('ok');
    expect(selected.selected[0]?.id).toBe('@acme/crm/users/search');
    expect(selected.ambiguous).toBe(false);
  });

  test('marks close non-exact pairs as ambiguous', () => {
    const fused = fuseSearchCandidates([
      { id: '@acme/crm/users/search', lexicalRank: 1, vectorRank: 2 },
      { id: '@acme/crm/users/list', lexicalRank: 2, vectorRank: 1 },
    ]);
    const selected = selectFusedHits(fused);
    expect(selected.ambiguous).toBe(true);
    expect(selected.selected).toHaveLength(2);
  });
});
