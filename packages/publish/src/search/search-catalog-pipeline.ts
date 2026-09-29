/* eslint-disable complexity, promise/avoid-new -- fusion + optional Jev within search deadline */
import type { HotFunctionDoc } from '../catalog/hot-catalog';
import { formatFunctionId } from '../function-id';
import { withTimeout } from './search-budget';
import type {
  CatalogSearchInput,
  CatalogSearchOutcome,
  SearchFunctionsContext,
  SearchFunctionsOptions,
} from './search-context';
import { isExactSearchMatch } from './search-exact';
import {
  fuseSearchCandidates,
  mergeBestRankMaps,
  selectFusedHits,
} from './search-fusion';
import { toHit } from './search-hits';
import { scoreFunctionDocument } from './search-lexical';
import type { SearchCandidateRow } from './search-ranking';
import { shouldRerankSearch } from './search-ranking';
import { applyAiRerankToSorted, buildRerankSummary } from './search-rerank';
import {
  SEARCH_BROWSE_MAX,
  SEARCH_DEADLINE_MS,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_JEV_BUDGET_MS,
  SEARCH_LEXICAL_TOP,
} from './search-result';
import type { SearchHit } from './search-result';
import { buildVectorRankMap } from './search-vector-channel';

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

const emptyOutcome = (
  reason: 'browse' | 'no_match',
  results: SearchHit[]
): CatalogSearchOutcome => ({
  ambiguous: false,
  explanation: results.map((hit) => ({
    fusedScore: 0,
    id: hit.id,
  })),
  reason,
  results,
});

/** Exact, lexical, vector fusion, browse fallback, and optional Jev rerank. */
export const runCatalogSearch = async (
  context: SearchFunctionsContext,
  input: CatalogSearchInput,
  options?: SearchFunctionsOptions
): Promise<CatalogSearchOutcome> => {
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
  const lexicalRank = mergeBestRankMaps(
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

  const fused = fuseSearchCandidates(
    [...nominatedIds].map((id) => ({
      exactRank: exactRank.get(id),
      id,
      lexicalRank: lexicalRank.get(id),
      vectorRank: vectorRank.get(id),
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
    packageSlug: row.doc.packageSlug,
    rerankSummary: buildRerankSummary(row.doc.contract, row.doc.searchText),
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
      id: row.fused.id,
      lexicalRank: row.fused.lexicalRank,
      vectorRank: row.fused.vectorRank,
    })),
    reason: selected.reason,
    results: orderedDocs.map((row) => toHit(row.doc)),
  };
};
