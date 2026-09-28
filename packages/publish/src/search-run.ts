/* eslint-disable complexity, promise/avoid-new, unicorn/no-await-expression-member, require-await -- ranking channels race against per-channel budgets */
import { traverseGraphNeighbors } from './capability-graph';
import { readCatalogGeneration } from './catalog-generation';
import { formatFunctionId } from './function-id';
import { loadGraphEdgesForSeeds } from './graph-hot';
import {
  buildAccessContextFromHotKv,
  filterDocsByAccess,
  loadHotFunctionDocsFromKv,
  loadSearchFunctionIdsFromHot,
} from './hot-catalog';
import type { HotFunctionDoc, SearchDomain } from './hot-catalog';
import type { HotKvBinding } from './http-context';
import { readOrgBoostMap } from './ranking-boost-kv';
import { storeSearchEventHot } from './search-analytics';
import { isExactSearchMatch } from './search-exact';
import { fuseSearchCandidates, selectFusedHits } from './search-fusion';
import { scoreFunctionDocument } from './search-lexical';
import type { SearchCandidateRow } from './search-ranking';
import { RERANK_POOL_MAX, shouldRerankSearch } from './search-ranking';
import {
  SEARCH_DEADLINE_MS,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_GRAPH_BUDGET_MS,
  SEARCH_GRAPH_NEIGHBORS,
  SEARCH_GRAPH_SEED,
  SEARCH_JEV_BUDGET_MS,
  SEARCH_LEXICAL_TOP,
  SEARCH_VECTOR_BUDGET_MS,
  SEARCH_VECTOR_MIN_SCORE,
  SEARCH_VECTOR_TOP_K,
  trimSearchResultToBudget,
} from './search-result';
import type {
  JsonValue,
  SearchHit,
  SearchResult,
  SearchTiming,
} from './search-result';
import type { EmbeddingIndex } from './vectorize-index';

export type { SearchDomain } from './hot-catalog';
export type { SearchHit, SearchResult } from './search-result';

export const normalizeSearchDomain = (domain?: SearchDomain): SearchDomain =>
  domain ?? 'mine';

const queryTokens = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1);

const withTimeout = async <T>(
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

const emptyTiming = (): SearchTiming => ({
  graphMs: 0,
  jevMs: 0,
  lexicalMs: 0,
  loadMs: 0,
  totalMs: 0,
  vectorMs: 0,
});

const asSearchContract = (contract: unknown): JsonValue | null => {
  if (contract === null || contract === undefined) {
    return null;
  }
  if (typeof contract !== 'object') {
    return null;
  }
  return contract as JsonValue;
};

const toHit = (doc: HotFunctionDoc): SearchHit => ({
  availability: doc.availability ?? 'ready',
  contract: asSearchContract(doc.contract),
  id: formatFunctionId({
    functionSlug: doc.functionSlug,
    handle: doc.handle,
    packageSlug: doc.packageSlug,
  }),
});

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

export interface SearchFunctionsContext {
  embedQuery?: (text: string) => Promise<number[]>;
  hot: HotKvBinding;
  nowMs?: number;
  vectorIndex?: EmbeddingIndex;
}

export interface SearchFunctionsOptions {
  remainingBudgetMs?: number;
  rerankScorer?: SearchRerankScorer;
}

export const searchFunctionsWithContext = async (
  context: SearchFunctionsContext,
  input: {
    callerUserId: string;
    domain?: SearchDomain;
    query?: string;
  },
  options?: SearchFunctionsOptions
): Promise<SearchResult> => {
  const started = Date.now();
  const timing = emptyTiming();
  const domain = normalizeSearchDomain(input.domain);
  const trimmedQuery = input.query?.trim() ?? '';
  const searchId = crypto.randomUUID();

  const loadStarted = Date.now();
  const [functionIds, accessContext] = await Promise.all([
    loadSearchFunctionIdsFromHot(context.hot, domain, input.callerUserId),
    buildAccessContextFromHotKv(context.hot, input.callerUserId),
  ]);
  const docs = filterDocsByAccess(
    await loadHotFunctionDocsFromKv(context.hot, functionIds),
    accessContext
  );
  timing.loadMs = Date.now() - loadStarted;

  const finish = async (
    result: Omit<SearchResult, 'searchId' | 'timing'> & {
      timing?: SearchTiming;
    }
  ): Promise<SearchResult> => {
    timing.totalMs = Date.now() - started;
    const payload: SearchResult = trimSearchResultToBudget({
      ...result,
      searchId,
      timing: result.timing ?? timing,
    });
    const organizationId = docs[0]?.organizationId;
    if (organizationId && trimmedQuery.length > 0) {
      await storeSearchEventHot({
        callerUserId: input.callerUserId,
        catalogGeneration: await readCatalogGeneration(
          context.hot,
          organizationId
        ),
        explanation: payload.explanation,
        hot: context.hot,
        organizationId,
        query: trimmedQuery,
        searchId,
      });
    }
    return payload;
  };

  if (trimmedQuery.length === 0) {
    const results = docs
      .slice(0, SEARCH_DEFAULT_LIMIT)
      .map((doc) => toHit(doc));
    return finish({
      ambiguous: false,
      explanation: results.map((hit) => ({
        fusedScore: 0,
        graphBonus: 0,
        id: hit.id,
        usageBoost: 0,
      })),
      reason: results.length === 0 ? 'no_match' : 'ok',
      results,
    });
  }

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

  const exactIds = docs
    .filter((doc) => isExactSearchMatch(trimmedQuery, doc))
    .map((doc) =>
      formatFunctionId({
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        packageSlug: doc.packageSlug,
      })
    );

  if (
    exactIds.length === 1 &&
    trimmedQuery.startsWith('@') &&
    docsById.has(trimmedQuery)
  ) {
    const doc = docsById.get(trimmedQuery);
    if (doc) {
      const hit = toHit(doc);
      return finish({
        ambiguous: false,
        explanation: [
          {
            exactRank: 1,
            fusedScore: 1,
            graphBonus: 0,
            id: hit.id,
            usageBoost: 0,
          },
        ],
        reason: 'ok',
        results: [hit],
      });
    }
  }

  const lexicalStarted = Date.now();
  const lexicalScored = [...docsById.entries()]
    .map(([id, doc]) => ({
      id,
      score: scoreFunctionDocument(trimmedQuery, {
        functionSlug: doc.functionSlug,
        handle: doc.handle,
        id,
        packageSlug: doc.packageSlug,
        searchText: doc.searchText,
      }),
    }))
    .toSorted((left, right) => right.score - left.score);
  const lexicalRanked = lexicalScored
    .filter((row) => row.score > 0)
    .slice(0, SEARCH_LEXICAL_TOP);
  const lexicalRank = new Map(
    lexicalRanked.map((row, index) => [row.id, index + 1])
  );
  timing.lexicalMs = Date.now() - lexicalStarted;

  const vectorRank = new Map<string, number>();
  if (context.vectorIndex && context.embedQuery) {
    const vectorStarted = Date.now();
    try {
      const queryVector = await withTimeout(
        context.embedQuery(trimmedQuery),
        SEARCH_VECTOR_BUDGET_MS,
        []
      );
      if (queryVector.length > 0) {
        const namespaces = [
          ...new Set(
            docs
              .map((doc) => doc.organizationId)
              .filter((value): value is string => Boolean(value))
          ),
        ];
        const matches = (
          await Promise.all(
            namespaces.map((namespace) =>
              withTimeout(
                context.vectorIndex?.query({
                  limit: SEARCH_VECTOR_TOP_K,
                  namespace,
                  vector: queryVector,
                }) ?? Promise.resolve([]),
                SEARCH_VECTOR_BUDGET_MS,
                []
              )
            )
          )
        ).flat();
        const seen = new Set<string>();
        let rank = 1;
        for (const match of matches.toSorted(
          (left, right) => right.score - left.score
        )) {
          if (
            !docsById.has(match.id) ||
            seen.has(match.id) ||
            match.score < SEARCH_VECTOR_MIN_SCORE
          ) {
            continue;
          }
          seen.add(match.id);
          vectorRank.set(match.id, rank);
          rank += 1;
        }
      }
    } catch {
      vectorRank.clear();
    }
    timing.vectorMs = Date.now() - vectorStarted;
  }

  const exactRank = new Map(exactIds.map((id, index) => [id, index + 1]));
  const nominatedIds = new Set([
    ...exactRank.keys(),
    ...lexicalRank.keys(),
    ...vectorRank.keys(),
  ]);

  const fusionInput = [...nominatedIds].map((id) => ({
    exactRank: exactRank.get(id),
    id,
    lexicalRank: lexicalRank.get(id),
    vectorRank: vectorRank.get(id),
  }));
  let fused = fuseSearchCandidates(fusionInput);

  const graphStarted = Date.now();
  try {
    const seeds = [
      ...fused.slice(0, SEARCH_GRAPH_SEED).map((row) => row.id),
      ...queryTokens(trimmedQuery).map((token) => `alias:${token}`),
    ];
    const edges = await withTimeout(
      loadGraphEdgesForSeeds(context.hot, seeds),
      SEARCH_GRAPH_BUDGET_MS,
      []
    );
    const accessible = new Set(docsById.keys());
    for (const seed of seeds) {
      accessible.add(seed);
    }
    const bonus = traverseGraphNeighbors(edges, seeds, accessible);
    const extraIds = [...bonus.keys()]
      .filter((id) => docsById.has(id) && !nominatedIds.has(id))
      .slice(0, SEARCH_GRAPH_NEIGHBORS);
    for (const id of extraIds) {
      nominatedIds.add(id);
    }
    const aliasHits = new Set(
      edges
        .filter(
          (edge) =>
            edge.type === 'reviewed_alias' && seeds.includes(edge.fromId)
        )
        .map((edge) => edge.toId)
    );
    fused = fuseSearchCandidates(
      [...nominatedIds].map((id) => ({
        exactRank: exactRank.get(id),
        graphBonus: bonus.get(id) ?? 0,
        id,
        lexicalRank: lexicalRank.get(id) ?? (aliasHits.has(id) ? 1 : undefined),
        vectorRank: vectorRank.get(id),
      }))
    );
  } catch {
    // graph down: keep fused lexical/vector
  }
  timing.graphMs = Date.now() - graphStarted;

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
    Math.max(0, SEARCH_DEADLINE_MS - (Date.now() - started));
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
      applyAiRerankToSorted(trimmedQuery, candidates, options.rerankScorer),
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

  return finish({
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
  });
};
