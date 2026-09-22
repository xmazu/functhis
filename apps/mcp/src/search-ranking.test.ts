import { describe, expect, test } from 'bun:test';

import { isExactSearchMatch, rankSearchCandidates } from './search-ranking';

describe('search ranking', () => {
  test('exact slug match ranks before closer vector neighbor', () => {
    const ranked = rankSearchCandidates(
      [
        {
          contract: { description: 'neighbor' },
          distance: 0.1,
          exactMatch: false,
          functionSlug: 'merge',
          handle: 'alice',
          packageSlug: 'tools',
        },
        {
          contract: { description: 'exact' },
          distance: 0.9,
          exactMatch: true,
          functionSlug: 'hello',
          handle: 'alice',
          packageSlug: 'tools',
        },
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

  test('includes text-only hits without vector distance', () => {
    const ranked = rankSearchCandidates(
      [
        {
          contract: { description: 'text only' },
          distance: null,
          exactMatch: false,
          functionSlug: 'merge',
          handle: 'alice',
          packageSlug: 'tools',
        },
      ],
      25
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.functionSlug).toBe('merge');
  });
});
