/* eslint-disable no-await-in-loop, require-await -- sequential live eval and REST batching */

/**
 * Opt-in live search evaluation: real Workers AI embeddings + OpenRouter Jev.
 *
 * Usage:
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... OPENROUTER_API_KEY=... \
 *     bun run eval:search:live
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CAPABILITY_EMBEDDING_DIMENSIONS,
  CAPABILITY_EMBEDDING_MODEL,
  CAPABILITY_VECTOR_KIND,
} from '@functhis/publish/embedding';
import type { SearchEvalJudgment } from '@functhis/publish/search-eval';
import { evaluateSearchRanking } from '@functhis/publish/search-eval';
import { createJevSearchRerankScorer } from '@functhis/publish/search-jev-rerank';
import { searchFunctionsWithContext } from '@functhis/publish/search-run';
import { MemoryEmbeddingIndex } from '@functhis/publish/vectorize-index';

import { seedEvalSearchCorpus } from '../src/harness/search-hot';

const corpusPath = path.join(import.meta.dir, '../src/search/eval-corpus.json');

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const embedViaWorkersAiRest = async (
  texts: readonly string[]
): Promise<number[][]> => {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const rows: number[][] = [];
  const batchSize = 8;
  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CAPABILITY_EMBEDDING_MODEL}`,
      {
        body: JSON.stringify({ text: batch }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error(
        `Workers AI embed failed (${String(response.status)}): ${await response.text()}`
      );
    }
    const payload = (await response.json()) as {
      result?: { data?: number[][] };
    };
    const data = payload.result?.data ?? [];
    for (const [index] of batch.entries()) {
      const vector = data[index];
      if (!vector || vector.length !== CAPABILITY_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Invalid embedding row at batch index ${String(index)}`
        );
      }
      rows.push(vector);
    }
  }
  return rows;
};

interface EvalCatalogEntry {
  contract?: Record<string, unknown>;
  functionSlug: string;
  handle: string;
  id: string;
  packageSlug: string;
  searchText: string;
}

const corpus = JSON.parse(readFileSync(corpusPath, 'utf-8')) as {
  catalog: EvalCatalogEntry[];
  queries: SearchEvalJudgment[];
};

const EVAL_ORG = 'org-live-eval';
const EVAL_USER = 'user-live-eval';

const memoryHotStore = () => {
  const store = new Map<string, string>();
  return {
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
  };
};

const buildVectorIndex = async (): Promise<MemoryEmbeddingIndex> => {
  const uniqueTexts = [
    ...new Set(corpus.catalog.map((entry) => entry.searchText)),
  ];
  const vectors = await embedViaWorkersAiRest(uniqueTexts);
  const byText = new Map<string, number[]>();
  for (const [index, text] of uniqueTexts.entries()) {
    byText.set(text, vectors[index] ?? []);
  }
  const index = new MemoryEmbeddingIndex();
  await index.upsert(
    corpus.catalog.map((entry) => ({
      id: entry.id,
      metadata: {
        kind: CAPABILITY_VECTOR_KIND,
        organizationId: EVAL_ORG,
      },
      namespace: EVAL_ORG,
      values: byText.get(entry.searchText) ?? [],
    }))
  );
  return index;
};

type EvalMode = 'lexical' | 'hybrid' | 'hybrid+jev';

const runMode = async (
  mode: EvalMode,
  hot: ReturnType<typeof memoryHotStore>,
  vectorIndex?: MemoryEmbeddingIndex
) => {
  const latencies: number[] = [];
  const results = [];
  const embedQueries =
    mode === 'lexical'
      ? undefined
      : (texts: readonly string[]) => embedViaWorkersAiRest(texts);
  const rerankScorer =
    mode === 'hybrid+jev'
      ? createJevSearchRerankScorer(requireEnv('OPENROUTER_API_KEY'))
      : () => Promise.resolve(null);

  for (const judgment of corpus.queries) {
    const started = Date.now();
    const outcome = await searchFunctionsWithContext(
      {
        embedQueries,
        hot,
        vectorIndex: mode === 'lexical' ? undefined : vectorIndex,
      },
      { callerUserId: EVAL_USER, domain: 'mine', query: judgment.query },
      { rerankScorer }
    );
    latencies.push(Date.now() - started);
    results.push({
      ids: outcome.results.map((row) => row.id),
      query: judgment.query,
    });
  }
  return evaluateSearchRanking(results, corpus.queries, latencies);
};

const printReport = (
  mode: EvalMode,
  report: ReturnType<typeof evaluateSearchRanking>
) => {
  console.log(`\n=== ${mode} ===`);
  console.log(`recall@10: ${report.recallAt10.toFixed(3)}`);
  console.log(`MRR: ${report.mrr.toFixed(3)}`);
  console.log(`nDCG@10: ${report.ndcgAt10.toFixed(3)}`);
  console.log(`no-match precision: ${report.noMatchPrecision.toFixed(3)}`);
  console.log(`p95 ms: ${report.p95Ms.toFixed(0)}`);
};

const main = async (): Promise<void> => {
  requireEnv('CLOUDFLARE_ACCOUNT_ID');
  requireEnv('CLOUDFLARE_API_TOKEN');

  console.log('Embedding catalog via Workers AI REST…');
  const vectorIndex = await buildVectorIndex();

  for (const mode of ['lexical', 'hybrid', 'hybrid+jev'] as const) {
    if (mode === 'hybrid+jev' && !process.env.OPENROUTER_API_KEY?.trim()) {
      console.log('\n=== hybrid+jev === (skipped: OPENROUTER_API_KEY unset)');
      continue;
    }
    const hot = memoryHotStore();
    await seedEvalSearchCorpus(hot, {
      catalog: corpus.catalog,
      handle: 'acme',
      organizationId: EVAL_ORG,
      ownerUserId: EVAL_USER,
    });
    const report = await runMode(mode, hot, vectorIndex);
    printReport(mode, report);
  }
};

await main();
