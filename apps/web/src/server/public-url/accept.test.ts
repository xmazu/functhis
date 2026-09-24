import { describe, expect, test } from 'bun:test';

import { wantsJsonCatalogResponse } from './accept';

describe('wantsJsonCatalogResponse', () => {
  test('returns true when Accept includes application/json', () => {
    const request = new Request('https://functhis.now/@a/p', {
      headers: { Accept: 'application/json' },
    });
    expect(wantsJsonCatalogResponse(request)).toBe(true);
  });

  test('returns false for typical browser navigation', () => {
    const request = new Request('https://functhis.now/@a/p', {
      headers: { Accept: 'text/html' },
    });
    expect(wantsJsonCatalogResponse(request)).toBe(false);
  });
});
