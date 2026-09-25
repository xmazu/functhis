import type { SearchCandidateRow } from './search-ranking';
import { RERANK_POOL_MAX } from './search-ranking';

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

export const applyAiRerankToSorted = async (
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
