import { describe, expect, test } from 'bun:test';

import { SEARCH_EVAL_CORPUS } from './search-eval-corpus';
import { rankCatalogHybrid, rankCatalogLexical } from './search-rank-catalog';

describe('rankCatalogLexical', () => {
  test('puts an exact id first', () => {
    expect(
      rankCatalogLexical(
        '@acme/crm/users/search',
        SEARCH_EVAL_CORPUS.catalog
      )[0]
    ).toBe('@acme/crm/users/search');
  });
});

describe('rankCatalogHybrid', () => {
  test('keeps exact ids first', () => {
    expect(
      rankCatalogHybrid('@acme/crm/users/search', SEARCH_EVAL_CORPUS.catalog)[0]
    ).toBe('@acme/crm/users/search');
  });
});
