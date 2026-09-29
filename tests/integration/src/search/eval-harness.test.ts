import { describe, expect, test } from 'bun:test';

import { searchFunctionsWithContext } from '@functhis/mcp/search';
import {
  evaluateSearchRanking,
  recallAtK,
} from '@functhis/publish/search-eval';
import type { SearchEvalJudgment } from '@functhis/publish/search-eval';

import { integrationHotBinding } from '../harness/mcp-env';
import { createMemoryHotKv } from '../harness/memory-hot-kv';
import { seedEvalSearchCorpus } from '../harness/search-hot';
import rawCorpus from './eval-corpus.json';

const corpus = rawCorpus as {
  catalog: {
    contract?: Record<string, unknown>;
    functionSlug: string;
    handle: string;
    id: string;
    packageSlug: string;
    searchText: string;
  }[];
  queries: SearchEvalJudgment[];
};

const EVAL_ORG = 'org-eval-corpus';
const EVAL_USER = 'user-eval-corpus';

const runCatalogSearch = async (judgments: readonly SearchEvalJudgment[]) => {
  const memoryHot = createMemoryHotKv();
  await seedEvalSearchCorpus(memoryHot, {
    catalog: corpus.catalog,
    handle: 'acme',
    organizationId: EVAL_ORG,
    ownerUserId: EVAL_USER,
  });
  const hot = integrationHotBinding(memoryHot);
  const startedAll = Date.now();
  const outcomes = await Promise.all(
    judgments.map((judgment) =>
      searchFunctionsWithContext(
        { hot },
        { callerUserId: EVAL_USER, domain: 'mine', query: judgment.query },
        { rerankScorer: () => Promise.resolve(null) }
      )
    )
  );
  const perQueryMs = (Date.now() - startedAll) / Math.max(judgments.length, 1);
  const latencies = judgments.map(() => perQueryMs);
  const results = judgments.map((judgment, index) => ({
    ids: outcomes[index]?.results.map((row) => row.id) ?? [],
    query: judgment.query,
  }));
  return { latencies, results };
};

describe('frozen search eval corpus', () => {
  test('lexical catalog search meets no-match, exact-id, and recall floors', async () => {
    const { latencies, results } = await runCatalogSearch(corpus.queries);
    const report = evaluateSearchRanking(results, corpus.queries, latencies);

    expect(report.noMatchPrecision).toBe(1);

    const exactJudgments = corpus.queries.filter(
      (row) => row.kind === 'exact-id'
    );
    for (const judgment of exactJudgments) {
      const ranked =
        results.find((row) => row.query === judgment.query)?.ids ?? [];
      expect(recallAtK(ranked, judgment.relevant, 10)).toBe(1);
    }

    const lexicalJudgments = corpus.queries.filter(
      (row) => row.kind !== 'paraphrase' && row.kind !== 'zero-overlap'
    );
    let recallSum = 0;
    for (const judgment of lexicalJudgments) {
      const ranked =
        results.find((row) => row.query === judgment.query)?.ids ?? [];
      recallSum += recallAtK(ranked, judgment.relevant, 10);
    }
    const lexicalRecall =
      lexicalJudgments.length === 0 ? 0 : recallSum / lexicalJudgments.length;
    expect(lexicalRecall).toBeGreaterThanOrEqual(0.7);

    expect(report.p95Ms).toBeGreaterThanOrEqual(0);
  });

  test('records paraphrase queries without asserting hybrid recall', async () => {
    const paraphrase = corpus.queries.filter(
      (row) => row.kind === 'paraphrase'
    );
    const { results } = await runCatalogSearch(paraphrase);
    expect(results.length).toBe(paraphrase.length);
    for (const row of results) {
      expect(row.ids.length).toBeGreaterThanOrEqual(0);
    }
  });
});
