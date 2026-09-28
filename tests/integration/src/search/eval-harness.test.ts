import { describe, expect, test } from 'bun:test';

import { deterministicEmbedding } from '@functhis/publish/embedding';
import {
  evaluateSearchRanking,
  foldSearchEvalSynonyms,
} from '@functhis/publish/search-eval';
import type { SearchEvalJudgment } from '@functhis/publish/search-eval';
import {
  rankCatalogHybrid,
  rankCatalogLexical,
} from '@functhis/publish/search-rank-catalog';
import type { RankableDoc } from '@functhis/publish/search-rank-catalog';

import rawCorpus from './eval-corpus.json';

const corpus = rawCorpus as {
  catalog: RankableDoc[];
  queries: SearchEvalJudgment[];
};

const [relevantDoc] = corpus.catalog;

const evalEmbed = (text: string): number[] =>
  deterministicEmbedding(
    relevantDoc ? foldSearchEvalSynonyms(text, relevantDoc) : text
  );

describe('frozen search eval corpus', () => {
  test('records lexical-only baseline before hybrid ranking', () => {
    const started = Date.now();
    const results = corpus.queries.map((judgment) => ({
      ids: rankCatalogLexical(judgment.query, corpus.catalog),
      query: judgment.query,
    }));
    const report = evaluateSearchRanking(results, corpus.queries, [
      Date.now() - started,
    ]);
    expect(
      results.find((row) => row.query === 'find the client by mail')?.ids
    ).toEqual([]);
    expect(report.recallAt10).toBeLessThan(1);
    expect(report.noMatchPrecision).toBe(1);
  });

  test('hybrid ranking recalls the zero-overlap synonym and keeps no-match empty', () => {
    const started = Date.now();
    const results = corpus.queries.map((judgment) => ({
      ids: rankCatalogHybrid(judgment.query, corpus.catalog, evalEmbed),
      query: judgment.query,
    }));
    const report = evaluateSearchRanking(results, corpus.queries, [
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
    expect(report.ndcgAt10).toBe(1);
    expect(report.noMatchPrecision).toBe(1);
    expect(report.p95Ms).toBeGreaterThanOrEqual(0);
  });
});
