import { describe, expect, test } from 'bun:test';

import { deterministicEmbedding } from './embedding';
import { evaluateSearchRanking, foldSearchEvalSynonyms } from './search-eval';
import { SEARCH_EVAL_CORPUS } from './search-eval-corpus';
import { rankCatalogHybrid, rankCatalogLexical } from './search-rank-catalog';

const [relevantDoc] = SEARCH_EVAL_CORPUS.catalog;

const evalEmbed = (text: string): number[] =>
  deterministicEmbedding(
    relevantDoc ? foldSearchEvalSynonyms(text, relevantDoc) : text
  );

describe('search eval corpus', () => {
  test('records lexical-only baseline before hybrid ranking', () => {
    const started = Date.now();
    const results = SEARCH_EVAL_CORPUS.queries.map((judgment) => ({
      ids: rankCatalogLexical(judgment.query, SEARCH_EVAL_CORPUS.catalog),
      query: judgment.query,
    }));
    const report = evaluateSearchRanking(results, SEARCH_EVAL_CORPUS.queries, [
      Date.now() - started,
    ]);
    const zeroOverlap = results.find(
      (row) => row.query === 'find the client by mail'
    );
    expect(zeroOverlap?.ids).toEqual([]);
    expect(report.recallAt10).toBeLessThan(1);
    expect(report.noMatchPrecision).toBe(1);
  });

  test('hybrid ranking recalls the zero-overlap synonym and keeps no-match empty', () => {
    const started = Date.now();
    const results = SEARCH_EVAL_CORPUS.queries.map((judgment) => ({
      ids: rankCatalogHybrid(
        judgment.query,
        SEARCH_EVAL_CORPUS.catalog,
        evalEmbed
      ),
      query: judgment.query,
    }));
    const report = evaluateSearchRanking(results, SEARCH_EVAL_CORPUS.queries, [
      Date.now() - started,
    ]);
    expect(
      results.find((row) => row.query === 'find the client by mail')?.ids[0]
    ).toBe('@acme/crm/users/search');
    expect(
      results.find((row) => row.query === '@acme/crm/users/search')?.ids
    ).toEqual(['@acme/crm/users/search']);
    expect(
      results.find((row) => row.query === 'quantum flux calibration')?.ids
    ).toEqual([]);
    expect(report.recallAt10).toBe(1);
    expect(report.mrr).toBe(1);
    expect(report.noMatchPrecision).toBe(1);
    expect(report.p95Ms).toBeGreaterThanOrEqual(0);
  });
});
