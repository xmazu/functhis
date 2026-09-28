/* eslint-disable complexity, promise/avoid-new, unicorn/no-await-expression-member, require-await -- ranking channels race against per-channel budgets */
import {
  buildAccessContextFromHotKv,
  filterDocsByAccess,
  loadHotFunctionDocsFromKv,
  loadSearchFunctionIdsFromHot,
} from '../catalog/hot-catalog';
import type { HotFunctionDoc, SearchDomain } from '../catalog/hot-catalog';
import { formatFunctionId, parseFunctionId } from '../function-id';
import type { HotKvBinding } from '../http/http-context';
import { readOrgBoostMap } from './ranking-boost-kv';
import { isExactSearchMatch } from './search-exact';
import { fuseSearchCandidates, selectFusedHits } from './search-fusion';
import { scoreFunctionDocument } from './search-lexical';
import type { SearchCandidateRow } from './search-ranking';
import { RERANK_POOL_MAX, shouldRerankSearch } from './search-ranking';
import {
  SEARCH_BROWSE_MAX,
  SEARCH_DEADLINE_MS,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_JEV_BUDGET_MS,
  SEARCH_LEXICAL_TOP,
  SEARCH_VECTOR_BUDGET_MS,
  SEARCH_VECTOR_MIN_SCORE,
  SEARCH_VECTOR_TOP_K,
} from './search-result';
import type {
  JsonValue,
  SearchExplanationRow,
  SearchHit,
  SearchTiming,
} from './search-result';
import type { EmbeddingIndex } from './vectorize-index';

export interface SearchRerankCard {
  functionSlug: string;
  handle: string;
  id: string;
  packageSlug: string;
  searchText: string;
}

export type SearchRerankScorer = (
  query: string,
  cards: SearchRerankCard[]
) => Promise<Map<string, number> | null>;

export interface SearchFunctionsContext {
  embedQuery?: (text: string) => Promise<number[]>;
  hot: HotKvBinding;
  nowMs?: number;
  onIndexSearchError?: (error: unknown) => void;
  vectorIndex?: EmbeddingIndex;
}

export interface SearchFunctionsOptions {
  remainingBudgetMs?: number;
  rerankScorer?: SearchRerankScorer;
}

const mergeBestRanks = (
  rankMaps: readonly Map<string, number>[]
): Map<string, number> => {
  const merged = new Map<string, number>();
  for (const ranks of rankMaps) {
    for (const [id, rank] of ranks) {
      const previous = merged.get(id);
      if (previous === undefined || rank < previous) {
        merged.set(id, rank);
      }
    }
  }
  return merged;
};

const lexicalRankForPhrasing = (
  phrasing: string,
  docsById: Map<string, HotFunctionDoc>
): Map<string, number> => {
  const scored = [...docsById.entries()]
    .map(([id, doc]) => ({
      id,
      score: scoreFunctionDocument(phrasing, {
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        id,
        packageSlug: doc.packageSlug,
        searchText: doc.searchText,
      }),
    }))
    .toSorted((left, right) => right.score - left.score);
  const ranked = scored
    .filter((row) => row.score > 0)
    .slice(0, SEARCH_LEXICAL_TOP);
  return new Map(ranked.map((row, index) => [row.id, index + 1]));
};

const lexicalScoresForPrimary = (
  primaryQuery: string,
  docsById: Map<string, HotFunctionDoc>
): { id: string; score: number }[] =>
  [...docsById.entries()]
    .map(([id, doc]) => ({
      id,
      score: scoreFunctionDocument(primaryQuery, {
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        id,
        packageSlug: doc.packageSlug,
        searchText: doc.searchText,
      }),
    }))
    .toSorted((left, right) => right.score - left.score);

export const withTimeout = async <T>(
  work: Promise<T>,
  budgetMs: number,
  fallback: T
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), budgetMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const asSearchContract = (contract: unknown): JsonValue | null => {
  if (contract === null || contract === undefined) {
    return null;
  }
  if (typeof contract !== 'object') {
    return null;
  }
  return contract as JsonValue;
};

export const toHit = (doc: HotFunctionDoc): SearchHit => ({
  availability: doc.availability ?? 'ready',
  contract: asSearchContract(doc.contract),
  id: formatFunctionId({
    functionSlug: doc.functionSlug,
    handle: doc.handle,
    packageSlug: doc.packageSlug,
  }),
});

const applyAiRerankToSorted = async (
  query: string,
  sorted: SearchCandidateRow[],
  scorer: SearchRerankScorer
): Promise<SearchCandidateRow[]> => {
  const head = sorted.slice(0, RERANK_POOL_MAX);
  const tail = sorted.slice(RERANK_POOL_MAX);
  const cards: SearchRerankCard[] = head.map((row) => ({
    functionSlug: row.functionSlug,
    handle: row.handle,
    id: row.id,
    packageSlug: row.packageSlug,
    searchText: row.searchText,
  }));
  const scores = await scorer(query, cards);
  if (!scores) {
    return sorted;
  }
  const headOrder = new Map(head.map((row, index) => [row.id, index]));
  const rerankedHead = [...head].toSorted((left, right) => {
    const leftScore = scores.get(left.id) ?? 0;
    const rightScore = scores.get(right.id) ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return (headOrder.get(left.id) ?? 0) - (headOrder.get(right.id) ?? 0);
  });
  return [...rerankedHead, ...tail];
};

export interface SearchFallbackInput {
  callerUserId: string;
  docs: HotFunctionDoc[];
  docsById: Map<string, HotFunctionDoc>;
  phrasings: string[];
  primaryQuery: string;
  started: number;
  timing: SearchTiming;
}

export interface SearchFallbackOutcome {
  ambiguous: boolean;
  explanation: SearchExplanationRow[];
  reason: 'browse' | 'no_match' | 'ok';
  results: SearchHit[];
}

const emptyOutcome = (
  reason: 'browse' | 'no_match',
  results: SearchHit[]
): SearchFallbackOutcome => ({
  ambiguous: false,
  explanation: results.map((hit) => ({
    fusedScore: 0,
    graphBonus: 0,
    id: hit.id,
    usageBoost: 0,
  })),
  reason,
  results,
});

export const loadFallbackDocs = async (
  hot: HotKvBinding,
  domain: SearchDomain,
  callerUserId: string
): Promise<{
  accessContext: Awaited<ReturnType<typeof buildAccessContextFromHotKv>>;
  docs: HotFunctionDoc[];
  docsById: Map<string, HotFunctionDoc>;
}> => {
  const [functionIds, accessContext] = await Promise.all([
    loadSearchFunctionIdsFromHot(hot, domain, callerUserId),
    buildAccessContextFromHotKv(hot, callerUserId),
  ]);
  const docs = filterDocsByAccess(
    await loadHotFunctionDocsFromKv(hot, functionIds),
    accessContext
  );
  const docsById = new Map(
    docs.map((doc) => [
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      }),
      doc,
    ])
  );
  return { accessContext, docs, docsById };
};

export const buildVectorRankMap = async (
  context: SearchFunctionsContext,
  input: {
    docs: HotFunctionDoc[];
    docsById: Map<string, HotFunctionDoc>;
    phrasings: string[];
    timing: SearchTiming;
  }
): Promise<Map<string, number>> => {
  const vectorRank = new Map<string, number>();
  const { embedQuery, vectorIndex } = context;
  if (!(vectorIndex && embedQuery)) {
    return vectorRank;
  }
  const vectorStarted = Date.now();
  try {
    const queryVectors = await withTimeout(
      Promise.all(input.phrasings.map((phrasing) => embedQuery(phrasing))),
      SEARCH_VECTOR_BUDGET_MS,
      input.phrasings.map(() => [] as number[])
    );
    const namespaces = [
      ...new Set(
        input.docs
          .map((doc) => doc.organizationId)
          .filter((value): value is string => Boolean(value))
      ),
    ];
    const rankMaps = await Promise.all(
      queryVectors
        .filter((queryVector) => queryVector.length > 0)
        .map(async (queryVector) => {
          const matches = (
            await Promise.all(
              namespaces.map((namespace) =>
                withTimeout(
                  vectorIndex.query({
                    limit: SEARCH_VECTOR_TOP_K,
                    namespace,
                    vector: queryVector,
                  }),
                  SEARCH_VECTOR_BUDGET_MS,
                  []
                )
              )
            )
          ).flat();
          const seen = new Set<string>();
          const ranks = new Map<string, number>();
          let rank = 1;
          for (const match of matches.toSorted(
            (left, right) => right.score - left.score
          )) {
            if (
              !input.docsById.has(match.id) ||
              seen.has(match.id) ||
              match.score < SEARCH_VECTOR_MIN_SCORE
            ) {
              continue;
            }
            seen.add(match.id);
            ranks.set(match.id, rank);
            rank += 1;
          }
          return ranks;
        })
    );
    for (const [id, rank] of mergeBestRanks(rankMaps)) {
      vectorRank.set(id, rank);
    }
  } catch {
    vectorRank.clear();
  }
  input.timing.vectorMs = Date.now() - vectorStarted;
  return vectorRank;
};

/**
 * Full-scan pipeline: lexical scan over every accessible doc, optional vector
 * channel, usage boosts, and optional JEV rerank. Runs only when the
 * federation index misses or is ambiguous, so recall never regresses while the
 * hot path stays in milliseconds.
 */
export const runSearchFallback = async (
  context: SearchFunctionsContext,
  input: SearchFallbackInput,
  options?: SearchFunctionsOptions
): Promise<SearchFallbackOutcome> => {
  const { docs, docsById, phrasings, primaryQuery } = input;
  const { timing } = input;

  if (phrasings.length === 0) {
    return emptyOutcome('no_match', []);
  }

  const exactIds = docs
    .filter((doc) => isExactSearchMatch(primaryQuery, doc))
    .map((doc) =>
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      })
    );

  const lexicalStarted = Date.now();
  const lexicalScored = lexicalScoresForPrimary(primaryQuery, docsById);
  const lexicalRank = mergeBestRanks(
    phrasings.map((phrasing) => lexicalRankForPhrasing(phrasing, docsById))
  );
  timing.lexicalMs = Date.now() - lexicalStarted;

  const vectorRank = await buildVectorRankMap(context, {
    docs,
    docsById,
    phrasings,
    timing,
  });

  const exactRank = new Map(exactIds.map((id, index) => [id, index + 1]));
  const nominatedIds = new Set([
    ...exactRank.keys(),
    ...lexicalRank.keys(),
    ...vectorRank.keys(),
  ]);

  let fused = fuseSearchCandidates(
    [...nominatedIds].map((id) => ({
      exactRank: exactRank.get(id),
      id,
      lexicalRank: lexicalRank.get(id),
      vectorRank: vectorRank.get(id),
    }))
  );

  const orgIds = [
    ...new Set(
      docs
        .map((doc) => doc.organizationId)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const boostMaps = await Promise.all(
    orgIds.map(async (organizationId) =>
      readOrgBoostMap(context.hot, organizationId)
    )
  );
  const usageBoosts = Object.assign({}, ...boostMaps) as Record<string, number>;
  fused = fuseSearchCandidates(
    fused.map((row) => ({
      exactRank: row.exactRank,
      graphBonus: row.graphBonus,
      id: row.id,
      lexicalRank: row.lexicalRank,
      usageBoost: usageBoosts[row.id] ?? 0,
      vectorRank: row.vectorRank,
    }))
  );

  const selected = selectFusedHits(fused, SEARCH_DEFAULT_LIMIT);
  if (
    selected.reason === 'no_match' &&
    docs.length > 0 &&
    docs.length <= SEARCH_BROWSE_MAX
  ) {
    const browseResults = docs
      .slice(0, SEARCH_DEFAULT_LIMIT)
      .map((doc) => toHit(doc));
    return emptyOutcome('browse', browseResults);
  }
  if (selected.reason === 'no_match') {
    return emptyOutcome('no_match', []);
  }

  let orderedDocs = selected.selected
    .map((row) => {
      const doc = docsById.get(row.id);
      if (!doc) {
        return null;
      }
      return { doc, fused: row };
    })
    .filter((row): row is { doc: HotFunctionDoc; fused: (typeof fused)[0] } =>
      Boolean(row)
    );

  const remainingBudget =
    options?.remainingBudgetMs ??
    Math.max(0, SEARCH_DEADLINE_MS - (Date.now() - input.started));
  const candidates: SearchCandidateRow[] = orderedDocs.map((row) => ({
    contract: row.doc.contract,
    exactMatch: row.fused.exactRank === 1,
    functionSlug: row.doc.functionSlug,
    fusedScore: row.fused.fusedScore,
    handle: row.doc.handle,
    id: row.fused.id,
    lexicalScore:
      lexicalScored.find((item) => item.id === row.fused.id)?.score ?? 0,
    packageSlug: row.doc.packageSlug,
    searchText: row.doc.searchText,
  }));
  const rerankDecision = shouldRerankSearch(candidates);
  if (
    rerankDecision.rerank &&
    remainingBudget >= SEARCH_JEV_BUDGET_MS &&
    options?.rerankScorer
  ) {
    const jevStarted = Date.now();
    const reranked = await withTimeout(
      applyAiRerankToSorted(primaryQuery, candidates, options.rerankScorer),
      SEARCH_JEV_BUDGET_MS,
      candidates
    );
    timing.jevMs = Date.now() - jevStarted;
    const byId = new Map(orderedDocs.map((row) => [row.fused.id, row]));
    orderedDocs = reranked.flatMap((row) => {
      const match = byId.get(row.id);
      return match ? [match] : [];
    });
  }

  return {
    ambiguous: selected.ambiguous,
    explanation: orderedDocs.map((row) => ({
      exactRank: row.fused.exactRank,
      fusedScore: row.fused.fusedScore,
      graphBonus: row.fused.graphBonus,
      id: row.fused.id,
      lexicalRank: row.fused.lexicalRank,
      usageBoost: row.fused.usageBoost,
      vectorRank: row.fused.vectorRank,
    })),
    reason: selected.reason,
    results: orderedDocs.map((row) => toHit(row.doc)),
  };
};

/** When vector is configured, defer to full scan if vector top-1 beats a synonym-only index win. */
export const indexSearchShouldDeferToFallback = async (
  context: SearchFunctionsContext,
  input: {
    callerUserId: string;
    domain: SearchDomain;
    indexTopId: string;
    phrasings: string[];
    primaryQuery: string;
    timing: SearchTiming;
  }
): Promise<boolean> => {
  if (!(context.vectorIndex && context.embedQuery)) {
    return false;
  }
  const loaded = await loadFallbackDocs(
    context.hot,
    input.domain,
    input.callerUserId
  );
  const indexLexical =
    lexicalScoresForPrimary(input.primaryQuery, loaded.docsById).find(
      (row) => row.id === input.indexTopId
    )?.score ?? 0;
  if (indexLexical > 0) {
    return false;
  }
  const vectorRank = await buildVectorRankMap(context, {
    docs: loaded.docs,
    docsById: loaded.docsById,
    phrasings: input.phrasings,
    timing: input.timing,
  });
  let vectorTopId: string | undefined;
  for (const [id, rank] of vectorRank) {
    if (rank === 1) {
      vectorTopId = id;
      break;
    }
  }
  return Boolean(vectorTopId && vectorTopId !== input.indexTopId);
};

export const refineIndexOutcomeWithJev = async (
  _context: SearchFunctionsContext,
  options: SearchFunctionsOptions | undefined,
  input: {
    outcome: SearchFallbackOutcome;
    primaryQuery: string;
    started: number;
    timing: SearchTiming;
  }
): Promise<SearchFallbackOutcome> => {
  if (!options?.rerankScorer || input.outcome.reason !== 'ok') {
    return input.outcome;
  }
  const candidates: SearchCandidateRow[] = input.outcome.results.flatMap(
    (hit, index) => {
      const parsed = parseFunctionId(hit.id);
      if (!parsed) {
        return [];
      }
      const explanation = input.outcome.explanation[index];
      return [
        {
          contract: hit.contract,
          exactMatch: explanation?.exactRank === 1,
          functionSlug: parsed.functionSlug,
          fusedScore: explanation?.fusedScore ?? 0,
          handle: parsed.handle,
          id: hit.id,
          lexicalScore: explanation?.indexScore ?? 0,
          packageSlug: parsed.packageSlug,
          searchText: '',
        },
      ];
    }
  );
  const rerankDecision = shouldRerankSearch(candidates);
  if (!rerankDecision.rerank) {
    return input.outcome;
  }
  const remainingBudget =
    options.remainingBudgetMs ??
    Math.max(0, SEARCH_DEADLINE_MS - (Date.now() - input.started));
  if (remainingBudget < SEARCH_JEV_BUDGET_MS) {
    return input.outcome;
  }
  const jevStarted = Date.now();
  const reranked = await withTimeout(
    applyAiRerankToSorted(input.primaryQuery, candidates, options.rerankScorer),
    SEARCH_JEV_BUDGET_MS,
    candidates
  );
  input.timing.jevMs = Date.now() - jevStarted;
  const order = new Map(reranked.map((row, index) => [row.id, index]));
  const results = [...input.outcome.results].toSorted(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
  );
  const explanation = [...input.outcome.explanation].toSorted(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
  );
  return { ...input.outcome, explanation, results };
};
